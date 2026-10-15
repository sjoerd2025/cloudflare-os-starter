import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface FunctionParameter {
  name: string;
  type?: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface ExtractedFunction {
  /** Function or method identifier */
  name: string;
  /** Syntactic kind */
  kind: 'function' | 'method' | 'arrow' | 'function_expression' | 'runtime_export';
  /** Absolute file path */
  filePath: string;
  /** Path relative to root target directory */
  relativeFilePath: string;
  /** Containing subproject or package name within cloudflare/ */
  packageName: string;
  /** 1-based start line */
  line: number;
  /** 1-based start column */
  column: number;
  /** Whether the function is declared async */
  isAsync: boolean;
  /** Whether the function is exported from its module */
  isExported: boolean;
  /** Structured parameters */
  parameters: FunctionParameter[];
  /** Inferred or declared return type string */
  returnType?: string;
  /** Leading JSDoc documentation */
  jsDoc?: string;
  /** Clean human-readable TypeScript signature */
  signature: string;
}

export interface ExtractCloudflareOptions {
  /**
   * Root directory to scan.
   * @default '/Volumes/ExternalSSD/projects/Github/cloudflare'
   */
  rootDir?: string;
  /**
   * Optional filter for specific subpackage directories (e.g. ['ai-utils', 'kv-asset-handler']).
   */
  packages?: string[];
  /**
   * File extensions to process.
   * @default ['.ts', '.tsx', '.js', '.mjs', '.cjs']
   */
  extensions?: string[];
  /**
   * Directory names to ignore during filesystem traversal.
   */
  ignoreDirs?: string[];
  /**
   * When true, only returns functions that are explicitly exported.
   * @default false
   */
  exportedOnly?: boolean;
  /**
   * Maximum total functions to extract across the directory.
   */
  limit?: number;
  /**
   * When true, dynamically imports supported ES modules to reflect on runtime function objects.
   * @default false
   */
  executeAndReflect?: boolean;
}

const DEFAULT_ROOT = '/Volumes/ExternalSSD/projects/Github/cloudflare';
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.wrangler',
  'coverage',
  '.next',
  '.cache',
  'fixtures',
  'vendor',
  '.vscode',
];

// Lazy-loaded TypeScript Compiler API instance
let cachedTs: any = undefined;

function getTs(): any {
  if (cachedTs !== undefined) return cachedTs;

  const candidatePaths = [
    '/Volumes/ExternalSSD/projects/Github/cloudflare-os-starter/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/typescript.js',
    path.join(process.cwd(), 'node_modules/typescript/lib/typescript.js'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        cachedTs = require(candidate);
        return cachedTs;
      } catch {
        // Continue search
      }
    }
  }

  try {
    cachedTs = require('typescript');
  } catch {
    cachedTs = null;
  }

  return cachedTs;
}

/**
 * Parses JSDoc documentation text attached to an AST node.
 */
function extractDocComment(node: any): string | undefined {
  if (node.jsDoc && Array.isArray(node.jsDoc)) {
    const comments = node.jsDoc.map((doc: any) => {
      if (typeof doc.comment === 'string') return doc.comment;
      if (Array.isArray(doc.comment)) {
        return doc.comment.map((c: any) => (typeof c === 'object' && 'text' in c ? c.text : '')).join('');
      }
      return '';
    });
    const joined = comments.filter(Boolean).join('\n').trim();
    if (joined) return joined;
  }
  return undefined;
}

/**
 * Extracts function parameters and types via TypeScript AST.
 */
function extractParametersFromTsNode(parameters: any[], sourceFile: any): FunctionParameter[] {
  return parameters.map((param: any) => {
    const name = param.name.getText(sourceFile);
    const type = param.type ? param.type.getText(sourceFile).trim() : undefined;
    const isOptional = Boolean(param.questionToken || param.initializer);
    const defaultValue = param.initializer ? param.initializer.getText(sourceFile).trim() : undefined;

    return {
      name,
      type,
      isOptional,
      defaultValue,
    };
  });
}

/**
 * AST-based function extraction for a single file using the TypeScript compiler API.
 */
export function extractFunctionsViaAst(
  filePath: string,
  rootDirectory: string,
  sourceCode: string
): ExtractedFunction[] {
  const ts = getTs();
  if (!ts) return [];

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true
  );

  const relativeFilePath = path.relative(rootDirectory, filePath);
  const segments = relativeFilePath.split(path.sep);
  const packageName = segments.length > 1 ? segments[0] : path.basename(rootDirectory);

  const list: ExtractedFunction[] = [];

  function record(
    name: string,
    kind: ExtractedFunction['kind'],
    node: any,
    parameters: FunctionParameter[],
    returnType: string | undefined,
    isAsync: boolean,
    isExported: boolean
  ) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const jsDoc = extractDocComment(node);

    const paramStr = parameters
      .map((p) => `${p.name}${p.isOptional ? '?' : ''}${p.type ? `: ${p.type}` : ''}`)
      .join(', ');
    const retStr = returnType ? `: ${returnType}` : '';
    const signature = `${isExported ? 'export ' : ''}${isAsync ? 'async ' : ''}function ${name}(${paramStr})${retStr}`;

    list.push({
      name,
      kind,
      filePath,
      relativeFilePath,
      packageName,
      line: line + 1,
      column: character + 1,
      isAsync,
      isExported,
      parameters,
      returnType,
      jsDoc,
      signature,
    });
  }

  function hasModifier(node: any, kindName: string): boolean {
    const modifiers = ts.canHaveModifiers?.(node) ? ts.getModifiers(node) : node.modifiers;
    if (!modifiers) return false;
    return Boolean(modifiers.some((m: any) => m.kind === ts.SyntaxKind[kindName]));
  }

  function walk(node: any) {
    // 1. Function declarations: function foo(...) { ... }
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const isExported = hasModifier(node, 'ExportKeyword');
      const isAsync = hasModifier(node, 'AsyncKeyword');
      const parameters = extractParametersFromTsNode(node.parameters, sourceFile);
      const returnType = node.type ? node.type.getText(sourceFile).trim() : undefined;

      record(name, 'function', node, parameters, returnType, isAsync, isExported);
    }

    // 2. Class Method declarations: class Foo { bar(...) { ... } }
    else if (ts.isMethodDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const isAsync = hasModifier(node, 'AsyncKeyword');
      const isExported = false;
      const parameters = extractParametersFromTsNode(node.parameters, sourceFile);
      const returnType = node.type ? node.type.getText(sourceFile).trim() : undefined;

      record(name, 'method', node, parameters, returnType, isAsync, isExported);
    }

    // 3. Arrow functions & function expressions assigned to variables: export const baz = async (...) => ...
    else if (ts.isVariableStatement(node)) {
      const isExported = hasModifier(node, 'ExportKeyword');

      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isIdentifier(decl.name)) {
          const name = decl.name.getText(sourceFile);
          const init = decl.initializer;

          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            const isAsync = hasModifier(init, 'AsyncKeyword');
            const kind = ts.isArrowFunction(init) ? 'arrow' : 'function_expression';
            const parameters = extractParametersFromTsNode(init.parameters, sourceFile);
            const returnType = init.type ? init.type.getText(sourceFile).trim() : undefined;

            record(name, kind, decl, parameters, returnType, isAsync, isExported);
          }
        }
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  return list;
}

/**
 * Fallback regex-based semantic function extractor used when TypeScript compiler API is unavailable.
 */
function extractFunctionsViaRegex(
  filePath: string,
  rootDirectory: string,
  sourceCode: string
): ExtractedFunction[] {
  const relativeFilePath = path.relative(rootDirectory, filePath);
  const segments = relativeFilePath.split(path.sep);
  const packageName = segments.length > 1 ? segments[0] : path.basename(rootDirectory);

  const lines = sourceCode.split('\n');
  const results: ExtractedFunction[] = [];

  // Patterns for function declarations and exported arrow functions
  const fnDeclRegex = /(?:export\s+)?(?:default\s+)?(async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/;
  const varFnRegex = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(async\s+)?(?:\(([^)]*)\)|([a-zA-Z0-9_$]+))\s*(?::\s*([^=]+))?\s*=>/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isExported = line.includes('export ');

    let match = line.match(fnDeclRegex);
    if (match) {
      const isAsync = Boolean(match[1]);
      const name = match[2];
      const rawParams = match[3] || '';
      const returnType = match[4]?.trim();

      const parameters: FunctionParameter[] = rawParams
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [n, t] = p.split(':').map((s) => s.trim());
          return { name: n, type: t, isOptional: n.includes('?') };
        });

      results.push({
        name,
        kind: 'function',
        filePath,
        relativeFilePath,
        packageName,
        line: i + 1,
        column: match.index ? match.index + 1 : 1,
        isAsync,
        isExported,
        parameters,
        returnType,
        signature: `${isExported ? 'export ' : ''}${isAsync ? 'async ' : ''}function ${name}(${rawParams})${returnType ? `: ${returnType}` : ''}`,
      });
      continue;
    }

    match = line.match(varFnRegex);
    if (match) {
      const name = match[1];
      const isAsync = Boolean(match[2]);
      const rawParams = match[3] || match[4] || '';
      const returnType = match[5]?.trim();

      const parameters: FunctionParameter[] = rawParams
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [n, t] = p.split(':').map((s) => s.trim());
          return { name: n, type: t, isOptional: n.includes('?') };
        });

      results.push({
        name,
        kind: 'arrow',
        filePath,
        relativeFilePath,
        packageName,
        line: i + 1,
        column: match.index ? match.index + 1 : 1,
        isAsync,
        isExported,
        parameters,
        returnType,
        signature: `${isExported ? 'export ' : ''}const ${name} = ${isAsync ? 'async ' : ''}(${rawParams}) => ...`,
      });
    }
  }

  return results;
}

/**
 * Extracts all functions from a single source file.
 */
export async function extractFunctionsFromFile(
  filePath: string,
  rootDirectory: string = path.dirname(filePath)
): Promise<ExtractedFunction[]> {
  const code = fs.readFileSync(filePath, 'utf-8');
  const ts = getTs();

  if (ts) {
    try {
      return extractFunctionsViaAst(filePath, rootDirectory, code);
    } catch {
      // Fallback on parser error
    }
  }

  return extractFunctionsViaRegex(filePath, rootDirectory, code);
}

/**
 * Dynamic runtime code execution reflection.
 * Evaluates live exported module properties to extract callable functions and metadata.
 */
export async function reflectModuleFunctions(
  modulePath: string,
  rootDirectory: string = path.dirname(modulePath)
): Promise<ExtractedFunction[]> {
  const results: ExtractedFunction[] = [];
  const relativeFilePath = path.relative(rootDirectory, modulePath);
  const segments = relativeFilePath.split(path.sep);
  const packageName = segments.length > 1 ? segments[0] : path.basename(rootDirectory);

  try {
    const mod = await import(modulePath);
    for (const [key, value] of Object.entries(mod)) {
      if (typeof value === 'function') {
        const isAsync = value.constructor.name === 'AsyncFunction';
        const paramCount = value.length;
        const parameters: FunctionParameter[] = Array.from({ length: paramCount }, (_, idx) => ({
          name: `arg${idx + 1}`,
          isOptional: false,
        }));

        results.push({
          name: key,
          kind: 'runtime_export',
          filePath: modulePath,
          relativeFilePath,
          packageName,
          line: 1,
          column: 1,
          isAsync,
          isExported: true,
          parameters,
          signature: `export ${isAsync ? 'async ' : ''}function ${key}(${parameters.map((p) => p.name).join(', ')})`,
        });
      }
    }
  } catch {
    // Cannot dynamically load non-ESM or uncompiled modules
  }

  return results;
}

/**
 * Main Semantic Extractor: Scans all subdirectories and files in `cloudflare`
 * and extracts all functions, methods, arrows, and signatures with semantic metadata.
 */
export async function extractCloudflareFunctions(
  options: ExtractCloudflareOptions = {}
): Promise<ExtractedFunction[]> {
  const rootDir = options.rootDir || DEFAULT_ROOT;
  const extensions = options.extensions || DEFAULT_EXTENSIONS;
  const ignoreDirs = new Set(options.ignoreDirs || DEFAULT_IGNORE_DIRS);
  const extSet = new Set(extensions);
  const targetPackages = options.packages ? new Set(options.packages) : undefined;
  const limit = options.limit;
  const exportedOnly = Boolean(options.exportedOnly);

  if (!fs.existsSync(rootDir)) {
    throw new Error(`Target directory does not exist: ${rootDir}`);
  }

  const allFunctions: ExtractedFunction[] = [];

  function walk(currentDir: string) {
    if (limit && allFunctions.length >= limit) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (limit && allFunctions.length >= limit) break;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name) || entry.name.startsWith('.')) {
          continue;
        }

        // Package filtering check if at level 1 beneath root
        if (targetPackages && currentDir === rootDir && !targetPackages.has(entry.name)) {
          continue;
        }

        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extSet.has(ext) && !entry.name.endsWith('.d.ts')) {
          try {
            const fileFunctions = extractFunctionsViaAst(
              fullPath,
              rootDir,
              fs.readFileSync(fullPath, 'utf-8')
            );

            for (const fn of fileFunctions) {
              if (exportedOnly && !fn.isExported) continue;
              allFunctions.push(fn);
              if (limit && allFunctions.length >= limit) break;
            }
          } catch {
            // Ignore parse errors on unusual file extensions
          }
        }
      }
    }
  }

  walk(rootDir);

  // If runtime reflection requested, enrich modules
  if (options.executeAndReflect) {
    const jsFiles = allFunctions
      .map((f) => f.filePath)
      .filter((p) => p.endsWith('.js') || p.endsWith('.mjs'));
    const uniqueFiles = Array.from(new Set(jsFiles));

    for (const file of uniqueFiles) {
      if (limit && allFunctions.length >= limit) break;
      const reflected = await reflectModuleFunctions(file, rootDir);
      for (const r of reflected) {
        if (!allFunctions.some((f) => f.filePath === r.filePath && f.name === r.name)) {
          allFunctions.push(r);
        }
      }
    }
  }

  return allFunctions;
}

// Direct Execution / CLI Support
if (process.argv[1] && process.argv[1].endsWith('extract-cloudflare-functions.ts')) {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const exportedOnly = args.includes('--export-only');
  const pkgArg = args.find((a) => a.startsWith('--package='));
  const targetPkg = pkgArg ? pkgArg.split('=')[1] : undefined;
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 30;

  console.error(`[Semantic Extractor] Scanning "${DEFAULT_ROOT}" (limit: ${limit}, exportedOnly: ${exportedOnly})...`);

  const results = await extractCloudflareFunctions({
    rootDir: DEFAULT_ROOT,
    packages: targetPkg ? [targetPkg] : undefined,
    exportedOnly,
    limit,
  });

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`\nExtracted ${results.length} functions across ${DEFAULT_ROOT}:\n`);
    for (const fn of results) {
      console.log(`• [${fn.packageName}] ${fn.signature}`);
      console.log(`   File: ${fn.relativeFilePath}:${fn.line}`);
      if (fn.jsDoc) {
        console.log(`   Description: ${fn.jsDoc.split('\n')[0].trim()}`);
      }
    }
  }
}
