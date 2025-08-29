# MCP Tool Schemas

> The source of truth is in `src/stdio-server.ts` and `src/http-server.ts`. This document mirrors the intent.

## fpe_encrypt

```jsonc
{
  "name": "fpe_encrypt",
  "description": "Encrypt a digit-domain string using FF3 FPE (radix-10). Returns ENC_FPE:<digits>.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "value": { "type": "string", "description": "String to encrypt. Non-digits are stripped before encryption." },
      "user_token": { "type": "string", "description": "Auth token (optional in authless/debug modes)." }
    },
    "required": ["value"]
  }
}
```

## fpe_decrypt

```jsonc
{
  "name": "fpe_decrypt",
  "description": "Decrypt a previous ENC_FPE:<digits> back to plaintext digits.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "value": { "type": "string", "description": "Ciphertext produced by fpe_encrypt (ENC_FPE:<digits>)." },
      "user_token": { "type": "string", "description": "Auth token (optional in authless/debug modes)." }
    },
    "required": ["value"]
  }
}
```

> In `authless` and `debug` modes, `user_token` can be omitted.
