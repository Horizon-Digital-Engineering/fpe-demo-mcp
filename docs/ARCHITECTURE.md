# Architecture

FPE Demo MCP supports **two transport modes**:

## stdio MCP (Default)
```mermaid
flowchart LR
  subgraph Client
    U[LLM Client]
  end

  subgraph MCP[FPE Demo MCP Server]
    A[AuthService\n(JWT or Shared Secret)]
    F[FPE Service\nFF3 (radix-10)]
  end

  U -- JSON-RPC (stdio) --> MCP
  A <-- verifies token --> U
  U -- call: fpe_encrypt / fpe_decrypt --> F
  F -- ENC_FPE:<digits> / plaintext --> U
```

- **Transport:** MCP JSON-RPC over stdio (child process)
- **Auth input:** token in tool argument (`user_token`)
- **Perfect for:** Claude Desktop, MCP clients

## HTTP MCP Streamable (Alternative)
```mermaid
flowchart LR
  subgraph Client
    W[Web Browser / curl]
  end

  subgraph HTTP[FPE Demo MCP HTTP Server]
    A[AuthService\n(JWT or Shared Secret)]
    F[FPE Service\nFF3 (radix-10)]
    S[Session Management\nMCP-Session-ID]
  end

  W -- POST /mcp --> HTTP
  S <-- manages sessions --> W
  A <-- verifies token --> W
  W -- call: fpe_encrypt / fpe_decrypt --> F
  F -- ENC_FPE:<digits> / plaintext --> W
```

- **Transport:** MCP Streamable HTTP on port 8765
- **Auth input:** `Authorization` header OR tool argument (`user_token`)
- **CORS:** Optional (enabled only when `CORS_ORIGIN` set)
- **Perfect for:** Browser testing, web clients, curl

## Common Components
- **Tools:** `fpe_encrypt`, `fpe_decrypt`
- **Auth modes:** authless (default), debug (open), test (shared secret OR JWT), production (JWT only for stricter testing)
- **FPE:** MYSTO FF3 radix-10, 6-56 digit range, ENC_FPE: prefix

## HTTP Server Implementation Details

### Stateful Session Management ✅
Our HTTP server follows the **official MCP StreamableHTTPServerTransport stateful pattern**:

- **Session Storage:** `transports` map keyed by `Mcp-Session-Id`
- **Transport Reuse:** Same transport handles multiple requests per session
- **Server Per Session:** New `McpServer` instance per session (MCP protocol requirement)
- **Session Lifecycle:** Initialize → reuse transport → cleanup on close

### Key Design Decisions

**Architecture Pattern:**
```typescript
// STATEFUL: Transport reuse per session
if (sessionId && transports[sessionId]) {
  transport = transports[sessionId];  // ← Reuse existing
} else {
  // NEW: Server + transport per session
  transport = new StreamableHTTPServerTransport({...});
  const server = getServer();  // ← New server per session
  await server.connect(transport);
}
```

**Polish Features:**
- **Container-friendly:** Binds to `0.0.0.0` (not `127.0.0.1`)
- **Case-insensitive headers:** `req.get('Mcp-Session-Id')` 
- **Proper CORS credentials:** Only set when origin is specific (not `*`)
- **Session ID echoing:** Headers included in responses for convenience

**Additional Features (Demo Implementation):**
- ✅ Session-based audit logging capability
- ✅ Multi-environment authentication modes  
- ✅ SSE support via GET/DELETE endpoints
- ✅ Transport lifecycle management
- ✅ Graceful shutdown handling (SIGTERM)

### Why Stateful vs Stateless?

**Our Choice: Stateful** because:
- Better for MCP protocol (official recommended pattern)
- Supports server-to-client notifications  
- Enables session tracking for audit/security
- More suitable for advanced features (rate limiting, etc.)

**Not Stateless** because:
- Stateless creates new server+transport per request (more overhead)
- No SSE support, no session correlation
- Less suitable for audit/tracking requirements
