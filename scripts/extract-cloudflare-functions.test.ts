import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractFunctionsViaAst,
  extractCloudflareFunctions,
} from './extract-cloudflare-functions.ts';

test('extractFunctionsViaAst: extracts semantic function metadata from TypeScript code', () => {
  const sampleCode = `
    /**
     * Calculates the sum of two numbers.
     * @param a First operand
     * @param b Second operand
     */
    export async function addNumbers(a: number, b: number = 0): Promise<number> {
      return a + b;
    }

    const helperArrow = (text: string): string => text.toUpperCase();

    export class Service {
      async execute(command: string): Promise<boolean> {
        return true;
      }
    }
  `;

  const results = extractFunctionsViaAst('/mock/path/sample.ts', '/mock/path', sampleCode);

  assert.equal(results.length, 3);

  // 1. Function declaration
  const fn1 = results.find((r) => r.name === 'addNumbers');
  assert.ok(fn1);
  assert.equal(fn1.kind, 'function');
  assert.equal(fn1.isAsync, true);
  assert.equal(fn1.isExported, true);
  assert.equal(fn1.returnType, 'Promise<number>');
  assert.equal(fn1.parameters.length, 2);
  assert.equal(fn1.parameters[0].name, 'a');
  assert.equal(fn1.parameters[0].type, 'number');
  assert.equal(fn1.parameters[1].name, 'b');
  assert.equal(fn1.parameters[1].defaultValue, '0');
  assert.ok(fn1.jsDoc?.includes('Calculates the sum of two numbers'));

  // 2. Arrow function
  const fn2 = results.find((r) => r.name === 'helperArrow');
  assert.ok(fn2);
  assert.equal(fn2.kind, 'arrow');
  assert.equal(fn2.isExported, false);
  assert.equal(fn2.parameters[0].name, 'text');

  // 3. Class method
  const fn3 = results.find((r) => r.name === 'execute');
  assert.ok(fn3);
  assert.equal(fn3.kind, 'method');
  assert.equal(fn3.isAsync, true);
  assert.equal(fn3.returnType, 'Promise<boolean>');
});

test('extractCloudflareFunctions: scans cloudflare directory packages', async () => {
  const functions = await extractCloudflareFunctions({
    rootDir: '/Volumes/ExternalSSD/projects/Github/cloudflare',
    packages: ['ai-utils'],
    limit: 10,
  });

  assert.ok(functions.length > 0, 'Expected to extract functions from cloudflare/ai-utils');
  const runWithTools = functions.find((f) => f.name === 'runWithTools');
  if (runWithTools) {
    assert.equal(runWithTools.packageName, 'ai-utils');
    assert.equal(runWithTools.isAsync, true);
  }
});
