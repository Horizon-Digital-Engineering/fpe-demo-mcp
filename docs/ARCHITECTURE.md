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
