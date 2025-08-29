# Troubleshooting

**Unauthorized**
- `authless` / `debug`: no token required.
- `test`: pass either `{"user_token": "<AUTH_TOKEN>"}` or `{"user_token": "Bearer <jwt>"}`.
- `production`: must pass a valid `Bearer <jwt>` (for testing stricter auth).

**HTTP Server Issues**
- CORS errors: Set `CORS_ORIGIN=https://your-domain.com` to enable CORS.
- Session errors: Use `MCP-Session-ID` header from initialize response in subsequent requests.
- Connection issues: Check that server is running on correct port (default 8765).

**Invalid input / wrong length**
- Encrypt expects **digits**. The server strips separators, but letters remain invalid for radix-10.
- Some FF3 libs enforce minimum/maximum length; surface the error to the caller.

**Ciphertext missing `ENC_FPE:`**
- Ensure you're calling the encrypt tool and not stripping the prefix downstream.
