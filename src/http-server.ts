
/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

import express from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { FPEService } from "./FPEService.js";
import { AuthService } from "./AuthService.js";

// --------------------- Config ---------------------
type AuthMode = "authless" | "debug" | "test" | "production";
const PORT = Number(process.env.PORT ?? 8765);
const HOST = process.env.HOST ?? "127.0.0.1";

// Get version from package.json safely
let version = "0.0.0";
try {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)).toString());
  version = pkg.version ?? version;
} catch { /* ignore */ }
const AUTH_MODE: AuthMode = (process.env.AUTH_MODE as AuthMode) || "authless";
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --------------------- Services -------------------
const fpe = new FPEService(process.env.FPE_KEY || "", process.env.FPE_TWEAK || "");
const auth = new AuthService(process.env.AUTH_TOKEN || "demo-secret");

// --------------------- Auth helper ----------------
function authorizeOrThrow(token?: string) {
  if (AUTH_MODE === "authless" || AUTH_MODE === "debug") return;

  const isBearer = token?.startsWith("Bearer ");
  const bearerValue = isBearer ? token!.slice("Bearer ".length).trim() : undefined;

  // Try JWT first if it's Bearer
  const jwtPayload = isBearer ? auth.verifyAuthorizationHeader(token!) : null;

  if (AUTH_MODE === "test") {
    const shared = process.env.AUTH_TOKEN || "demo-secret";
    const sharedOk = (bearerValue ?? token) === shared; // works with "Bearer foo" or just "foo"
    if (!jwtPayload && !sharedOk) {
      throw new McpError(ErrorCode.InvalidRequest, "Unauthorized (test mode: need valid JWT or AUTH_TOKEN)");
    }
    return;
  }

  // production: must be a valid JWT
  if (!jwtPayload) throw new McpError(ErrorCode.InvalidRequest, "Unauthorized (production mode: Bearer JWT required)");
}

// --------------------- MCP Server -----------------
const server = new McpServer(
  { name: "fpe-demo-mcp", version },
  { capabilities: { tools: {} } }
);

// Register tools (auth via header or user_token fallback)
server.registerTool(
  "fpe_encrypt",
  {
    title: "FF3 FPE Encrypt",
    description:
      "Encrypt digits using FF3 (radix-10, 6–56 digits). Input normalized to digits only. Returns ENC_FPE:digits.",
    inputSchema: {
      value: z.string().describe("Input containing digits to encrypt; non-digits are stripped."),
      user_token: z.string().optional().describe("Auth token (optional in authless/debug; header is preferred in HTTP)."),
    },
  },
  async ({ value, user_token }, _ctx) => {
    const timestamp = new Date().toISOString();
    console.log(`\n📥 [HTTP] [${timestamp}] fpe_encrypt called:`);
    console.log(`   Value: ${value}`);
    console.log(`   User Token: ${user_token ? user_token.substring(0, 10) + '...' : 'undefined'}`);
    
    const headerToken = _ctx?._meta?.authorization as string | undefined; // <-- use _meta
    console.log(`   Header Token: ${headerToken ? headerToken.substring(0, 20) + '...' : 'undefined'}`);
    const token = headerToken || user_token;
    
    console.log(`🔐 [HTTP] Checking authorization for fpe_encrypt...`);
    authorizeOrThrow(token);
    console.log(`✅ [HTTP] Authorization successful for fpe_encrypt`);

    if (!value) {
      console.log(`❌ [HTTP] Missing required parameter: value`);
      throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: value");
    }
    
    console.log(`🔒 [HTTP] Encrypting value: ${value}`);
    const encrypted = fpe.encrypt(value);
    console.log(`✅ [HTTP] Encryption successful: ${encrypted}`);
    return {
      content: [
        { type: "text", text: `Encrypted: ${encrypted}\nAuth Mode: ${AUTH_MODE}\nNote: ENC_FPE: indicates FF3-encrypted digits.` },
      ],
    };
  }
);

server.registerTool(
  "fpe_decrypt",
  {
    title: "FF3 FPE Decrypt",
    description: "Decrypt ENC_FPE:digits back to original digits.",
    inputSchema: {
      value: z.string().describe("Value in ENC_FPE:digits format."),
      user_token: z.string().optional().describe("Auth token (optional in authless/debug)."),
    },
  },
  async ({ value, user_token }, _ctx) => {
    const timestamp = new Date().toISOString();
    console.log(`\n📥 [HTTP] [${timestamp}] fpe_decrypt called:`);
    console.log(`   Value: ${value}`);
    console.log(`   User Token: ${user_token ? user_token.substring(0, 10) + '...' : 'undefined'}`);
    
    const headerToken = _ctx?._meta?.authorization as string | undefined; // <-- use _meta
    console.log(`   Header Token: ${headerToken ? headerToken.substring(0, 20) + '...' : 'undefined'}`);
    const token = headerToken || user_token;
    
    console.log(`🔐 [HTTP] Checking authorization for fpe_decrypt...`);
    authorizeOrThrow(token);
    console.log(`✅ [HTTP] Authorization successful for fpe_decrypt`);

    if (!value) {
      console.log(`❌ [HTTP] Missing required parameter: value`);
      throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: value");
    }
    
    console.log(`🔓 [HTTP] Decrypting value: ${value}`);
    const decrypted = fpe.decrypt(value);
    console.log(`✅ [HTTP] Decryption successful: ${decrypted}`);
    return {
      content: [{ type: "text", text: `Decrypted: ${decrypted}\nAuth Mode: ${AUTH_MODE}` }],
    };
  }
);

// Single transport instance (adapter mode; no port/host in options)
const transport = new StreamableHTTPServerTransport({
  eventStore: new InMemoryEventStore(),
  sessionIdGenerator: () => randomUUID(),
  // No CORS here — we'll do CORS in Express middleware
});

// Server readiness tracking
let serverReady = false;

// Connect (wrap in IIFE to avoid top-level await)
(async () => {
  await server.connect(transport);
  serverReady = true;
})().catch((err) => {
  console.error("Failed to connect MCP server:", err);
  process.exit(1);
});

// --------------------- Express (POST only) --------
const app = express();

// CORS only if CORS_ORIGIN is set (for browser playground testing)
if (process.env.CORS_ORIGIN) {
  app.use((req, res, next) => {
    const reqOrigin = (req.headers.origin as string) || "";
    let allowOrigin = "*";

    if (CORS_ORIGINS.length === 1 && CORS_ORIGINS[0] === "*") {
      allowOrigin = reqOrigin || "*"; // echo origin for credentials
    } else if (reqOrigin && CORS_ORIGINS.includes(reqOrigin)) {
      allowOrigin = reqOrigin;
    } else if (CORS_ORIGINS.length && CORS_ORIGINS[0] !== "*") {
      allowOrigin = CORS_ORIGINS[0];
    }

    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Echo any requested headers (avoids preflight rejections)
    const reqHdrs = (req.headers["access-control-request-headers"] as string) || "";
    const baseAllowed =
      "Accept, Content-Type, Authorization, MCP-Session-ID, mcp-session-id, Last-Event-ID";
    res.setHeader("Access-Control-Allow-Headers", [baseAllowed, reqHdrs].filter(Boolean).join(", "));

    res.setHeader("Access-Control-Expose-Headers", "MCP-Session-ID, mcp-session-id");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

    // Private Network Access (Chrome/Edge to 127.0.0.1 from HTTPS)
    if (req.headers["access-control-request-private-network"] === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }

    if (req.method === "OPTIONS") return res.writeHead(204).end();
    next();
  });
}

// MCP endpoint (POST only). IMPORTANT: mount BEFORE express.json()
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const newSession = !sessionId;
  const timestamp = new Date().toISOString();
  
  console.log(`\n🌐 [HTTP-MCP] [${timestamp}] Incoming MCP request:`);
  console.log(`   Method: ${req.method}`);
  console.log(`   Session ID: ${sessionId || 'NEW'}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
  console.log(`   Origin: ${req.headers.origin || 'none'}`);
  console.log(`   Auth Header: ${req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none'}`);
  
  // Seed a session header if the client didn't provide one
  if (newSession) {
    const newSessionId = randomUUID();
    res.setHeader("MCP-Session-ID", newSessionId);
    console.log(`🔗 New MCP session created: ${newSessionId}`);
  } else {
    console.log(`📡 Continuing MCP session: ${sessionId}`);
  }
  
  try {
    console.log(`🔄 [HTTP-MCP] Processing request...`);
    await transport.handleRequest(req, res);
    console.log(`✅ [HTTP-MCP] Request completed successfully`);
  } catch (err) {
    console.error(`🚨 [HTTP-MCP] Request error:`, err);
    console.error(`   Error type: ${err instanceof Error ? err.constructor.name : typeof err}`);
    console.error(`   Error message: ${err instanceof Error ? err.message : String(err)}`);
    // Fallback error envelope (SDK usually handles this)
    if (!res.headersSent) {
      console.log(`📤 [HTTP-MCP] Sending fallback error response`);
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request" },
        id: null,
      });
    }
  }
});

// NOW parse JSON for your other routes
app.use(express.json({ limit: "10mb" }));

// Health check with request logging
app.get("/health", (req, res) => {
  const origin = req.headers.origin;
  console.log(`🏥 Health check from ${origin || 'direct'}`);
  
  res.json({
    status: "ok",
    auth_mode: AUTH_MODE,
    version,
    host: HOST,
    cors_enabled: !!process.env.CORS_ORIGIN,
    mcp_endpoint: "/mcp",
    timestamp: new Date().toISOString(),
  });
});

// Kubernetes readiness probe
app.get("/ready", (req, res) => {
  if (serverReady) {
    res.status(200).json({ status: "ready" });
  } else {
    res.status(503).json({ status: "not ready" });
  }
});

// Kubernetes liveness probe
app.get("/live", (req, res) => {
  res.status(200).json({ status: "alive" });
});

// SIGTERM handler for platform shutdowns (K8s, Cloud Run, etc.)
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`✅ FPE Demo MCP HTTP at http://${HOST}:${PORT}/mcp`);
  console.log(`   CORS: ${process.env.CORS_ORIGIN ? "enabled" : "disabled"}`);
  console.log(`   CORS_ORIGIN: ${CORS_ORIGINS.join(", ") || "(none)"}`);
  console.log(`   Auth Mode: ${AUTH_MODE}`);
  console.log(`   Tools: fpe_encrypt, fpe_decrypt`);
});