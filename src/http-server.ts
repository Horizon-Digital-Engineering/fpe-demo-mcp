
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
import { McpError, ErrorCode, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { FPEService } from "./FPEService.js";
import { AuthService } from "./AuthService.js";

// --------------------- Config ---------------------
type AuthMode = "authless" | "debug" | "test" | "production";
const PORT = Number(process.env.PORT ?? 8765);
const HOST = process.env.HOST ?? "0.0.0.0";

// Get version from package.json safely
let version = "0.0.0";
try {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
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
  const bearerValue = isBearer && token ? token.slice("Bearer ".length).trim() : undefined;

  // Try JWT first if it's Bearer
  const jwtPayload = isBearer && token ? auth.verifyAuthorizationHeader(token) : null;

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

// --------------------- MCP Server Factory (Official Pattern) -----------------
const getServer = (): McpServer => {
  const server = new McpServer({ name: "fpe-demo-mcp", version });

  // Register tools (auth via header or user_token fallback)
  server.registerTool(
    "fpe_encrypt",
    {
      title: "FF3 FPE Encrypt",
      description: FPEService.TOOL_DESCRIPTIONS.fpe_encrypt.description,
      inputSchema: {
        value: z.string().describe(FPEService.TOOL_DESCRIPTIONS.fpe_encrypt.inputDescription),
        user_token: z.string().optional().describe("Authentication token (required in test/production modes, optional in debug mode)"),
      },
    },
    async ({ value, user_token }, _ctx) => {
      const timestamp = new Date().toISOString();
      console.log(`\n📥 [HTTP] [${timestamp}] fpe_encrypt called:`);
      console.log(`   Value: ${value}`);
      console.log(`   User Token: ${user_token ? user_token.substring(0, 10) + '...' : 'undefined'}`);
      
      const headerToken = _ctx?._meta?.authorization as string | undefined;
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
      description: FPEService.TOOL_DESCRIPTIONS.fpe_decrypt.description,
      inputSchema: {
        value: z.string().describe(FPEService.TOOL_DESCRIPTIONS.fpe_decrypt.inputDescription),
        user_token: z.string().optional().describe("Authentication token (required in test/production modes, optional in debug mode)"),
      },
    },
    async ({ value, user_token }, _ctx) => {
      const timestamp = new Date().toISOString();
      console.log(`\n📥 [HTTP] [${timestamp}] fpe_decrypt called:`);
      console.log(`   Value: ${value}`);
      console.log(`   User Token: ${user_token ? user_token.substring(0, 10) + '...' : 'undefined'}`);
      
      const headerToken = _ctx?._meta?.authorization as string | undefined;
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

  return server;
};

// Map to store transports by session ID (official pattern)
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Server readiness tracking
const serverReady = true;

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
    
    // Only set credentials when origin is specific (not *)
    if (allowOrigin !== "*") {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    // Echo any requested headers (avoids preflight rejections)
    const reqHdrs = (req.headers["access-control-request-headers"] as string) || "";
    const baseAllowed =
      "Accept, Content-Type, Authorization, MCP-Session-ID, mcp-session-id, Last-Event-ID";
    res.setHeader("Access-Control-Allow-Headers", [baseAllowed, reqHdrs].filter(Boolean).join(", "));

    // Match docs' canonical header casing
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-session-id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");

    // Private Network Access (Chrome/Edge to 127.0.0.1 from HTTPS)
    if (req.headers["access-control-request-private-network"] === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }

    if (req.method === "OPTIONS") return res.writeHead(204).end();
    next();
  });
}

// Parse JSON for MCP requests
app.use(express.json({ limit: "10mb" }));

// MCP POST endpoint (Official Streamable Pattern)
app.post("/mcp", async (req, res) => {
  // Check for existing session ID (case-insensitive)
  const sessionId = req.get('Mcp-Session-Id');
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
    console.log(`📡 Using existing transport for session: ${sessionId}`);
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    console.log(`🔗 Creating new session for initialize request`);
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore: new InMemoryEventStore(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        console.log(`Session initialized with ID: ${sessionId}`);
        transports[sessionId] = transport;
      }
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        console.log(`Transport closed for session ${transport.sessionId}, removing from transports map`);
        delete transports[transport.sessionId];
      }
    };

    const server = getServer();
    // ... server setup already done in getServer() ...

    // Connect to the MCP server
    await server.connect(transport);
  } else {
    // Invalid request
    console.log(`❌ Invalid request: sessionId=${sessionId}, isInit=${isInitializeRequest(req.body)}`);
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: req.body?.id || null,
    });
    return;
  }

  // Echo session ID in response headers for convenience
  if (transport.sessionId) {
    res.setHeader('Mcp-Session-Id', transport.sessionId);
  }

  // Handle the request
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("POST request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal Error"
        },
        id: req.body?.id || null
      });
    }
  }
});

// GET endpoint for server→client notifications
app.get("/mcp", async (req, res) => {
  const sessionId = req.get('Mcp-Session-Id');
  console.log(`GET request for session: ${sessionId || 'UNKNOWN'}`);
  
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Session not found" },
      id: null,
    });
  }
  
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error(`GET request error:`, err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// DELETE endpoint for session termination
app.delete("/mcp", async (req, res) => {
  const sessionId = req.get('Mcp-Session-Id');
  console.log(`DELETE request for session: ${sessionId || 'UNKNOWN'}`);
  
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Session not found" },
      id: null,
    });
  }
  
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error(`DELETE request error:`, err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// JSON parsing is already set up above for MCP endpoints

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