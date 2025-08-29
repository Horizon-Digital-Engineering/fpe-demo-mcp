# Using FPE Demo MCP with LLM Clients

FPE Demo MCP supports **two modes**: MCP stdio (for LLM clients) and HTTP MCP Streamable (for web/browser testing). Most LLM clients use the **stdio MCP mode**.

## Claude Desktop (Claude Code)

1) Install & build:
```bash
npm install
npm run build
```

2) Add an MCP server entry (Claude Desktop settings → MCP):
```json
{
  "mcpServers": {
    "fpe-demo-mcp": {
      "command": "node",
      "args": ["/full/path/to/fpe-demo-mcp/dist/src/stdio-server.js"],
      "env": {
        "AUTH_MODE": "authless"
      }
    }
  }
}
```

3) Restart Claude; you should see `fpe_encrypt` and `fpe_decrypt` available.

> In `test`/`production`, pass `user_token` when invoking tools (Claude will include it if you ask it to).

## ChatGPT / Cursor / other MCP‑compatible clients

Add a similar MCP server entry in your client’s external tools configuration:
```json
{
  "name": "fpe-demo-mcp",
  "command": "node",
  "args": ["/full/path/to/fpe-demo-mcp/dist/src/stdio-server.js"],
  "env": {
    "AUTH_MODE": "authless"
  }
}
```

### What the LLM sees

- **`fpe_encrypt`**: "Encrypt digits using FF3 (radix‑10). Returns `ENC_FPE:<digits>`."
- **`fpe_decrypt`**: "Decrypt `ENC_FPE:<digits>` back to original digits."

### Example prompt

> "Encrypt this SSN 123‑45‑6789 using the FPE Demo MCP tool and show the ciphertext."
