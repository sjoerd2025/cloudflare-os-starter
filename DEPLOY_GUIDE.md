# Cloudflare OS Starter Deployment Guide

A complete guide to deploying your customized Cloudflare OS instance using this starter repository.

## Prerequisites

Before starting, ensure you have:

1. **Node.js 24.19 or newer**
   ```bash
   node --version
   ```

2. **pnpm 11.17**
   ```bash
   npm install -g pnpm
   pnpm --version
   ```

3. **Cloudflare Account**
   - Active Cloudflare account with Workers, KV, R2, and Browser Rendering enabled
   - Find your [Account ID](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)

4. **Cloudflare Access Setup** (for production)
   - Cloudflare One subscription
   - Active Cloudflare zone (for custom domain)
   - Configured self-hosted Access application

## Step 1: Initial Setup

### 1.1 Clone and initialize the repository

```bash
git clone https://github.com/sjoerd2025/cloudflare-os-starter.git
cd cloudflare-os-starter

# Initialize the submodule
git submodule update --init

# Install dependencies
pnpm install
pnpm --dir cloudflare-os install

# Authenticate with Cloudflare
pnpm exec wrangler login
```

### 1.2 Verify installation

```bash
node --version      # Should be 24.19+
pnpm --version      # Should be 11.17+
pnpm exec wrangler whoami
```

## Step 2: Configure deployment.jsonc

Edit `deployment.jsonc` with your deployment settings:

### 2.1 Account and Base Configuration

```jsonc
{
  // Your Cloudflare account ID (32 hex characters)
  "accountId": "<YOUR_ACCOUNT_ID>",
  
  // Leave null to derive from router's custom domain
  // On workers.dev: https://<router-name>.<subdomain>.workers.dev
  "publicBaseUrl": null,
  
  "workers": {
    "router": {
      "name": "my-os-router",
      // Production: use a hostname in your Cloudflare zone
      "route": { "customDomain": "os.example.com" }
      // Evaluation: "route": { "workersDev": true }
    },
    "workshop": { "name": "my-os-workshop" },
    "context": { "name": "my-os-context" },
    "scheduler": { "name": "my-os-scheduler" },
    "customGatekeeper": { "name": "my-os-custom" },
    "errorReporter": { "name": "my-os-error-reporter" }
  }
}
```

### 2.2 Cloudflare Access Configuration

First, create a [self-hosted Access application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/):

1. Go to **Cloudflare Dashboard** → **Cloudflare One**
2. Navigate to **Access** → **Applications**
3. Click **Add an application** → **Self-hosted**
4. Configure:
   - **Application name**: Your deployment name
   - **Subdomain**: Any available subdomain for your team domain
   - **Domain**: Leave the default (usually `cloudflareaccess.com`)
   - **Application URL**: Your custom domain (e.g., `https://os.example.com`)
5. Save and note the **AUD (Audience) tag** from the **Authorization** tab

Then update `deployment.jsonc`:

```jsonc
{
  "access": {
    "issuer": "https://<YOUR_TEAM_NAME>.cloudflareaccess.com",
    "audience": "<YOUR_AUD_TAG>",
    "admins": ["admin@example.com", "admin2@example.com"]
  }
}
```

### 2.3 AI Gateway Configuration

```jsonc
{
  "aiGateway": {
    "enabled": true,
    "name": "default",  // or your custom gateway name
    "accountId": null,  // null = same account as deployment
    "providers": ["cloudflare", "anthropic", "openai"]  // or just ["cloudflare"]
  }
}
```

**Note**: If using `anthropic`, `openai`, or `google` providers, you'll need to set up an API token (see Step 3.2).

### 2.4 Custom Gatekeeper Display

```jsonc
{
  "customGatekeeper": {
    "name": "Your Organization Name",
    "message": "Integration with Your Organization for deployment information"
  }
}
```

### 2.5 Context and Storage Configuration

```jsonc
{
  "context": {
    "sharingDomain": null,  // null = scope to public origin
    "kvNamespaceId": null   // null = auto-provision with Wrangler
    // Optional: Git-backed storage (requires Artifacts account access)
    // "artifacts": {
    //   "enabled": true,
    //   "namespace": "my-context-collections"
    // }
  },
  
  "resources": {
    "blueprintsKvNamespaceId": null,
    "avatarsKvNamespaceId": null,
    "blueprintContentBucket": null
  }
}
```

### 2.6 Error Reporting Configuration

```jsonc
{
  "errorReporting": {
    "enabled": true,
    "environment": "production",
    "release": null  // Set to commit/version hash when available
  }
}
```

### 2.7 Observability Configuration

```jsonc
{
  "observability": {
    "enabled": true,
    "headSamplingRate": 1,  // 0-1, 1 = 100% sampling
    "logs": {
      "invocationLogs": false
    },
    "traces": {
      "enabled": false,
      "headSamplingRate": 0.1
    }
  }
}
```

## Step 3: Configure Secrets and APIs

### 3.1 AI Gateway API Token (if needed)

If using `anthropic`, `openai`, or `google` providers:

```bash
# Create a narrowly-scoped API token: https://dash.cloudflare.com/profile/api-tokens
# Permissions: AI Gateway (Read) or (Run + Read) for custom providers

CLOUDFLARE_ACCOUNT_ID=<YOUR_ACCOUNT_ID> \
pnpm exec wrangler secret put CF_AI_GATEWAY_API_TOKEN \
  --name <YOUR_WORKSHOP_WORKER_NAME>
```

### 3.2 Additional Secrets (if applicable)

For custom Gatekeepers with external APIs:

```bash
# Example: custom service credentials
CLOUDFLARE_ACCOUNT_ID=<YOUR_ACCOUNT_ID> \
pnpm exec wrangler secret put CUSTOM_API_KEY \
  --name <WORKER_NAME>
```

## Step 4: Validate Configuration

Run the validation script to catch configuration issues before deploying:

```bash
pnpm check
```

This will:
- Parse and validate `deployment.jsonc`
- Check Worker names are unique and properly formatted
- Verify Access configuration
- Validate AI Gateway setup and token requirements
- Run test suite
- Build all Workers (dry-run)

### Common Validation Errors

| Error | Solution |
| --- | --- |
| `Missing required deployment value` | Fill in the placeholder value in `deployment.jsonc` |
| `Worker names must be unique` | Change duplicate Worker names to be unique |
| `publicBaseUrl does not match customDomain` | Set `publicBaseUrl` to `null` or matching value |
| `CF_AI_GATEWAY_API_TOKEN is required` | Run the secret installation command above |

## Step 5: Deploy

Once validation passes, deploy all Workers:

```bash
pnpm deploy
```

The deploy script will:

1. Generate production Wrangler configs for each Worker
2. Build all packages and Workers
3. Deploy in order:
   - Error Reporter (if enabled)
   - Context Gatekeeper
   - Scheduler Gatekeeper
   - Custom Gatekeeper
   - Workshop backend
   - Router (last—binds everything)

### Deployment Output

Successful deployment shows:
```
✓ Uploaded router (x.xx KB)
✓ Uploaded workshop (x.xx KB)
✓ Uploaded context (x.xx KB)
✓ Uploaded scheduler (x.xx KB)
✓ Uploaded custom-gatekeeper (x.xx KB)
✓ Uploaded error-reporter (x.xx KB)
```

## Step 6: Verify Deployment

### 6.1 Check Access and Sign-In

```bash
# Open your router hostname
open https://os.example.com

# Expected: Cloudflare Access login, then the Cloudflare OS interface
```

### 6.2 Verify Admin Access

1. Go to `/admin` (e.g., `https://os.example.com/admin`)
2. Confirm your email appears as authorized
3. Test changing branding (site name, logo, color)
4. Note: Branding changes apply immediately, no deploy needed

### 6.3 Test Core Features

```bash
# 1. Router hostname resolves
dig os.example.com

# 2. Check Worker logs
pnpm exec wrangler tail --name my-os-router

# 3. Test backend connectivity
# Go to /admin → Custom Gatekeeper → Enable
# Ask the agent for deployment information

# 4. Verify Storage
# KV namespaces should exist in Cloudflare dashboard
# R2 bucket should exist for blueprint content
```

### 6.4 Inspect Error Reporter (if enabled)

```bash
# View structured error logs
pnpm exec wrangler logs --name my-os-error-reporter
```

## Step 7: Post-Deployment Configuration

### 7.1 Customize Branding (No Deploy Required)

1. Navigate to `/admin`
2. Go to the **General** tab
3. Update:
   - **Site Name**: Display name for your deployment
   - **Logo**: Upload PNG, JPEG, WebP, or SVG (max 5 MB)
   - **Accent Color**: Hex color for UI elements
4. Changes apply immediately

### 7.2 Configure Context Artifacts (Optional)

If you enabled Artifacts in `deployment.jsonc`:

```jsonc
"context": {
  "artifacts": { "enabled": true }
}
```

1. Go to `/admin` → **Context**
2. Create a Git-backed Context collection
3. Provide repository URL and branch
4. Collections auto-refresh on schedule

### 7.3 Enable Scheduled Work (Scheduler)

1. Go to `/admin` → **Scheduler**
2. Set availability (available / optional / disabled)
3. Agents can now schedule work to run in the future

### 7.4 Custom Gatekeeper Integration

1. Go to `/admin` → **Custom Gatekeeper**
2. Enable/disable the custom integration
3. Test by asking agents to read deployment information

## Troubleshooting

### Issue: `git submodule update --init` fails

**Solution**: Ensure you have git installed and internet access. Try:
```bash
git submodule sync
git submodule update --init --recursive
```

### Issue: `pnpm install` times out or fails

**Solution**: Try clearing cache and reinstalling:
```bash
rm -rf node_modules .pnpm-store pnpm-lock.yaml
pnpm install
```

### Issue: Validation fails with missing placeholders

**Solution**: Check `deployment.jsonc` for any `<...>` placeholders and replace with actual values:
```bash
grep -n '<' deployment.jsonc
```

### Issue: Deploy fails with "Worker name already exists"

**Solution**: Change the Worker names in `deployment.jsonc` to be unique within your account:
```jsonc
"workers": {
  "router": { "name": "my-unique-os-router-v2" }
  // ... etc
}
```

### Issue: Access returns "Invalid Audience"

**Solution**: Verify the AUD tag in `/admin` of your Access application:
1. Cloudflare Dashboard → Cloudflare One → Access → Applications
2. Click your application
3. Go to **Authorization** tab
4. Copy the **AUD** value
5. Update `access.audience` in `deployment.jsonc`

### Issue: AI Gateway returns 401 or 403

**Solution**: Check token configuration:
```bash
# Verify the token is installed
CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID> \
pnpm exec wrangler secret list --name <WORKSHOP_NAME>

# Reinstall if missing
CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID> \
pnpm exec wrangler secret put CF_AI_GATEWAY_API_TOKEN \
  --name <WORKSHOP_NAME>
```

### Issue: Context collections not persisting

**Solution**: Verify KV namespace configuration:
1. Cloudflare Dashboard → Workers → KV
2. Confirm namespace exists matching your config
3. If using Artifacts, check it's enabled in `deployment.jsonc`

## Ongoing Operations

### Monitor Logs

```bash
# Real-time logs for all Workers
pnpm exec wrangler tail --name my-os-router

# Filter by Worker
pnpm exec wrangler tail --name my-os-workshop
```

### Handle Errors

1. Go to `/admin` (Admins only)
2. Review structured error reports
3. Check Error Reporter Worker logs:
   ```bash
   pnpm exec wrangler logs --name my-os-error-reporter
   ```

### Upgrade Cloudflare OS

See [Customization Guide: Upgrade](docs/customization.md#upgrade) for detailed instructions:

```bash
# 1. Record current submodule commit
git rev-parse cloudflare-os:

# 2. Update submodule
git submodule update --remote cloudflare-os

# 3. Review changes
git diff cloudflare-os

# 4. Re-sync workspace config
# ... see docs/customization.md for details

# 5. Run full validation and deploy
pnpm install
pnpm --dir cloudflare-os install
pnpm check
pnpm deploy

# If issues: rollback
git checkout <previous-commit> cloudflare-os
pnpm deploy
```

### Roll Back a Worker

```bash
# See deployment history
pnpm exec wrangler deployments list --name <WORKER_NAME>

# Rollback to a previous version
pnpm exec wrangler rollback --name <WORKER_NAME>
```

## Advanced Configuration

### Using Existing KV/R2 Resources

If you already have KV namespaces or R2 buckets:

```jsonc
{
  "context": {
    "kvNamespaceId": "your-existing-namespace-id"
  },
  "resources": {
    "blueprintsKvNamespaceId": "existing-blueprints-id",
    "blueprintContentBucket": "existing-bucket-name"
  }
}
```

### Custom AI Gateway

To use a gateway in a different Cloudflare account:

```jsonc
{
  "aiGateway": {
    "enabled": true,
    "name": "custom-gateway",
    "accountId": "different-account-id"
  }
}
```

Then install the cross-account token:
```bash
CLOUDFLARE_ACCOUNT_ID=<YOUR_ACCOUNT_ID> \
pnpm exec wrangler secret put CF_AI_GATEWAY_API_TOKEN \
  --name <YOUR_WORKSHOP_WORKER_NAME>
```

### Enable Browser Reporting

Configure in [docs/observability.md](docs/observability.md) for client-side error collection and source map uploads.

## Support and Resources

- [Cloudflare OS Documentation](https://github.com/cloudflare/cloudflare-os)
- [Cloudflare Workers Guide](https://developers.cloudflare.com/workers/)
- [Customization Guide](docs/customization.md)
- [Observability Guide](docs/observability.md)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)

## Summary Checklist

- [ ] Node.js 24.19+ installed
- [ ] pnpm 11.17+ installed
- [ ] Repository cloned and submodule initialized
- [ ] `deployment.jsonc` filled in completely
- [ ] Cloudflare Access application created (if using Access)
- [ ] AI Gateway token installed (if required)
- [ ] `pnpm check` passes
- [ ] `pnpm deploy` succeeds
- [ ] `/admin` page accessible
- [ ] Admin email can access `/admin`
- [ ] Branding can be customized
- [ ] Error logs accessible
- [ ] Scheduled work functional (Scheduler)

---

**Last Updated**: October 2026
**Repository**: https://github.com/sjoerd2025/cloudflare-os-starter
**Based On**: Cloudflare OS v1.0+
