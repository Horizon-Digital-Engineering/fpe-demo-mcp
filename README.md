# FPE Demo MCP — FF3 Format Preserving Encryption Server

![Version](https://img.shields.io/github/v/tag/Horizon-Digital-Engineering/fpe-demo-mcp?label=version&color=blue) ![License](https://img.shields.io/github/license/Horizon-Digital-Engineering/fpe-demo-mcp?color=green) ![CI](https://github.com/Horizon-Digital-Engineering/fpe-demo-mcp/actions/workflows/ci.yml/badge.svg) ![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)

**FPE Demo MCP** is a lightweight MCP (Model Context Protocol) server that demonstrates **authentication** and **format‑preserving encryption (FF3 FPE)** in a clean, readable implementation. MCP is a JSON-RPC protocol that enables LLMs to securely call external tools and services.

- ✅ FF3 FPE over **digits** (radix‑10)
- 🔐 Auth modes: `authless`, `debug`, `test` (shared secret *or* JWT), `production` (JWT only)
- 🏷️ `ENC_FPE:` prefix so encrypted values are obvious in logs/demos
- 🌐 Both stdio (local) and HTTP (web) transports

> **Demo Implementation:** This shows how FF3 FPE + MCP authentication work together. Great for learning, prototyping, and understanding the concepts.

## 🚀 Quick Deploy

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Horizon-Digital-Engineering/fpe-demo-mcp/tree/main)

**What this does:** Deploys the MCP server to DigitalOcean App Platform with HTTPS, giving you a public URL for testing with web-based LLMs like ChatGPT or Claude web connectors.

**Remote MCP URL:** `https://<your-app>.ondigitalocean.app/mcp`

**Auth modes:**
- `AUTH_MODE=authless` for quick tests
- `AUTH_MODE=test` + header `Authorization: Bearer <AUTH_TOKEN>`
- `AUTH_MODE=production` + Bearer JWT

> **Note:** App Platform terminates HTTPS; your app runs plain HTTP. Set `HOST=0.0.0.0` and DO injects `PORT`.

---

## Local Testing

### MCP stdio (for LLM clients)

```bash
npm install
npm run build

# Start MCP server (stdio transport)
npm start
# or: AUTH_MODE=debug npm start
```

Perfect for: Claude Desktop, Claude Code, any local MCP-compatible tool.

### HTTP server (for web testing)

```bash
# Basic HTTP server (no CORS)
npm run start:http

# With CORS for browser playground testing
CORS_ORIGIN=https://playground.ai.cloudflare.com npm run start:http
```

Server runs at `http://127.0.0.1:8765/mcp` using MCP Streamable HTTP protocol.

Both servers expose the same two tools:
- `fpe_encrypt` — encrypts a digit-domain string and returns `ENC_FPE:...`
- `fpe_decrypt` — decrypts a prior `ENC_FPE:...` payload

---

## Try it (copy‑paste examples)

### MCP stdio testing

**Encrypt**
```bash
echo '{
  "jsonrpc":"2.0","id":1,"method":"tools/call",
  "params":{"name":"fpe_encrypt","arguments":{"value":"123-45-6789"}}
}' | node dist/src/stdio-server.js
```

**Decrypt**
```bash
echo '{
  "jsonrpc":"2.0","id":2,"method":"tools/call",
  "params":{"name":"fpe_decrypt","arguments":{"value":"ENC_FPE:096616337"}}
}' | node dist/src/stdio-server.js
```

### HTTP MCP testing

**Initialize connection**
```bash
curl -i http://127.0.0.1:8765/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

**List tools** (use MCP-Session-ID from previous response)
```bash
curl -s http://127.0.0.1:8765/mcp \
  -H 'Content-Type: application/json' \
  -H 'MCP-Session-ID: <session-id>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

**Encrypt**
```bash
curl -s http://127.0.0.1:8765/mcp \
  -H 'Content-Type: application/json' \
  -H 'MCP-Session-ID: <session-id>' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fpe_encrypt","arguments":{"value":"123-45-6789"}}}'
```

> Both servers normalize input to digits for radix‑10 before encryption.

---

## Auth & Config

- `AUTH_MODE`: `authless` (default) | `debug` | `test` | `production`
- **Shared secret** (test mode): `AUTH_TOKEN="demo-secret"` → pass as `{"user_token":"demo-secret"}`
- **JWT** (test/production): Pass as `{"user_token":"Bearer <jwt>"}` or `Authorization` header
  - **JWT Secret**: Uses `demo-secret` by default, or set `AUTH_JWT_SECRET` for different signing key
  - **JWT Algorithm**: HS256 (symmetric key)
  - **Optional Claims**: Set `AUTH_JWT_ISS` for issuer validation, `AUTH_JWT_AUD` for audience validation

**FPE Configuration** (defaults provided):
```bash
export FPE_KEY=00112233445566778899aabbccddeeff    # 32-char hex key
export FPE_TWEAK=abcdef12345678                    # 14-char hex tweak
```


---

## How it works (short version)

- **MCP server**: exposes `fpe_encrypt` / `fpe_decrypt` tools via stdio JSON-RPC.  
- **Auth**:
  - `authless`/`debug` → skip
  - `test`  → shared secret or JWT (HS256)
  - `production` → JWT only (for testing stricter auth)  
- **FPE (FF3)**:
  - Radix-10 cipher (digits only) using AES key + tweak.
  - Input normalized to digits (e.g., SSN `123-45-6789` → `123456789`) before encryption.
  - Ciphertext returned as `ENC_FPE:<digits>` to be visually obvious in the demo.

---

## Beyond this demo

This demo shows the core concepts. For real-world usage, you'd need:

- **Key Management**: KMS integration (AWS KMS, GCP KMS, HashiCorp Vault)
- **Per-record tweaks**: Unique tweaks per user/record to prevent pattern analysis
- **Audit trails**: Comprehensive logging for compliance (PCI, SOX, GDPR)
- **Input validation**: Schema enforcement and rate limiting
- **Metadata tracking**: Database fields to track encryption state, not string prefixes
- **Infrastructure**: Load balancing, monitoring, backup/recovery
- **Compliance**: Security reviews, penetration testing, certifications

---

## FAQ

**Why the `ENC_` prefix?**  
It's a teaching aid — newcomers can *see* that a value is encrypted. In real systems, you'd likely omit it.

**Why only digits?**  
FF3 operates over a **radix**. We start with radix-10 because it’s the clearest demo (SSNs, phones). You can extend to radix-36 (`0-9a-z`) if your library/config supports it.

**Can I switch to RS256 JWT?**  
Yes — load a PEM public key and set the algorithm to `RS256`. The verification call stays the same.

---

## Browser vs Remote Usage

**For browser playground testing** (like [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)), use the HTTP server with CORS:

```bash
CORS_ORIGIN=https://playground.ai.cloudflare.com npm run start:http
```

**For remote server-to-server usage** (ChatGPT, Claude via API, or production integrations), CORS is not needed:

```bash
npm run start:http
```

The MCP HTTP transport works with both browser-based and server-to-server clients. Browser clients require CORS headers, while server-to-server clients (like ChatGPT Actions or Claude's server integrations) don't need CORS.

For production deployment with web-based LLMs, see our [Deployment Guide](docs/DEPLOYMENT.md) which covers DigitalOcean App Platform and other hosting options.

---

## Docs

- **Deployment Guide** → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Using with Claude/ChatGPT/others** → [docs/USAGE-LLMS.md](docs/USAGE-LLMS.md) 
- **Architecture** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **JSON Schemas** → [docs/SCHEMAS.md](docs/SCHEMAS.md)
- **FF3 limitations** → [docs/LIMITATIONS.md](docs/LIMITATIONS.md)

BSL 1.1 — see `LICENSE.md`.
