# Deployment Guide

## DigitalOcean App Platform (Easy HTTPS for Web LLM Testing)

DigitalOcean App Platform provides a quick way to get a **public HTTPS** URL for testing your MCP server with web-based LLMs.

### Option 1: One-Click Deploy Button

Use the deploy button in the main README - it automatically uses the `app.yaml` in this repo for proper configuration.

### Option 2: Manual GUI Deploy

1. Push your repo to GitHub
2. In DO → **App Platform → Create App → GitHub repo**
3. When it detects Node.js, set:
   * **Build command:** `npm ci && npm run build`
   * **Run command:** `node dist/src/http-server.js`
4. **Environment Variables** (Service → Settings → Environment Variables):
   * `HOST=0.0.0.0` ← important for platform networking
   * `AUTH_MODE=test` (or `authless` to start)
   * `AUTH_TOKEN=demo-secret` (if using `test`)
   * `FPE_KEY=00112233445566778899aabbccddeeff`
   * `FPE_TWEAK=abcdef12345678`
5. Deploy. DO will give you an HTTPS URL like `https://fpe-demo-mcp-xxxxx.ondigitalocean.app`.

### Option 3: App Spec (YAML) - Automated

The repo includes `app.yaml` for automatic configuration:

```yaml
name: fpe-demo-mcp
services:
  - name: app
    environmentSlug: node-js
    github:
      repo: your-user/your-repo
      branch: main
      deployOnPush: true
    buildCommand: "npm ci && npm run build"
    runCommand: "node dist/src/http-server.js"
    httpPort: 8765
    instanceCount: 1
    instanceSizeSlug: basic-xxs
    routes:
      - path: /
    envs:
      - key: HOST
        value: "0.0.0.0"
      - key: AUTH_MODE
        value: "test"
      - key: AUTH_TOKEN
        value: "demo-secret"
      - key: FPE_KEY
        value: "00112233445566778899aabbccddeeff"
      - key: FPE_TWEAK
        value: "abcdef12345678"
```

### Testing Your Deployment

```bash
# Initialize connection
curl -i https://<your-app>.ondigitalocean.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer demo-secret' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

# List tools (reuse MCP-Session-ID from previous response)
curl -s https://<your-app>.ondigitalocean.app/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer demo-secret' \
  -H 'MCP-Session-ID: <paste from previous>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

### Connect to Claude (Web)

* **Server URL:** `https://<your-app>.ondigitalocean.app/mcp`
* **Header (if AUTH_MODE=test):** `Authorization: Bearer demo-secret`

### Important Notes

* **Bind to 0.0.0.0** (set `HOST=0.0.0.0`) so the platform proxy can reach your app
* App Platform provides **automatic HTTPS** - no certificate management needed
* Check App Platform pricing - dynamic Node services typically require a paid tier
* For $0 demos, consider using Cloudflare Tunnel instead

## Local Development

### Basic HTTP Server
```bash
npm run start:http
```

### With CORS (for browser testing)
```bash
CORS_ORIGIN=https://playground.ai.cloudflare.com npm run start:http
```

### Different Auth Modes
```bash
# Debug mode
AUTH_MODE=debug npm run start:http

# Test mode with shared secret
AUTH_MODE=test AUTH_TOKEN=your-secret npm run start:http

# Production mode (requires JWT)
AUTH_MODE=production npm run start:http
```

## Health Check

Your deployed server includes a health endpoint:

```bash
curl https://<your-app>.ondigitalocean.app/health
```

Returns server status, auth mode, available tools, and CORS configuration.