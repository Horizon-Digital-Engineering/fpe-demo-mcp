#!/usr/bin/env node

/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { FPEService } from './FPEService.js';
import { AuthService } from './AuthService.js';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Auth modes
type AuthMode = 'authless' | 'debug' | 'test' | 'production';
const AUTH_MODE = (process.env.AUTH_MODE as AuthMode) || 'authless';

// Initialize services  
const fpeService = new FPEService('', ''); // Uses demo keys for POC
const auth = new AuthService(process.env.AUTH_TOKEN || 'demo-secret'); // also uses AUTH_JWT_SECRET internally

// Drop-in auth-mode gate (copy/paste pattern)
function authorizeOrThrow(args?: Record<string, unknown>) {
  const token = (args?.user_token as string) ?? ''; // MCP: pass token in tool args
  
  // In authless or debug mode, allow all requests
  if (AUTH_MODE === 'authless' || AUTH_MODE === 'debug') {
    console.log(`✅ [STDIO-AUTH] ${AUTH_MODE} mode - access granted`);
    return;
  }

  // try JWT first (if token looks like Bearer)
  const maybeJwt = token.startsWith('Bearer ') ? auth.verifyAuthorizationHeader(token) : null;

  if (AUTH_MODE === 'test') {
    const sharedOk = token === (process.env.AUTH_TOKEN || 'demo-secret');
    if (!maybeJwt && !sharedOk) {
      console.log(`❌ [STDIO-AUTH] Test mode auth failed - JWT: ${!!maybeJwt}, Shared secret: ${sharedOk}`);
      throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized (test mode: need valid JWT or AUTH_TOKEN)');
    }
    console.log(`✅ [STDIO-AUTH] Test mode - authentication successful`);
    return;
  }

  // production: JWT required
  if (!maybeJwt) {
    console.log(`❌ [STDIO-AUTH] Production mode - JWT required but not valid`);
    throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized (production mode: Bearer JWT required)');
  }
  console.log(`✅ [STDIO-AUTH] Production mode - JWT authentication successful`);
}

// MCP Server
class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'fpe-demo-mcp',
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'fpe_encrypt',
            description: FPEService.TOOL_DESCRIPTIONS.fpe_encrypt.description,
            inputSchema: {
              type: 'object',
              properties: {
                value: {
                  type: 'string',
                  description: FPEService.TOOL_DESCRIPTIONS.fpe_encrypt.inputDescription
                },
                user_token: {
                  type: 'string',
                  description: 'Authentication token (required in test/production modes, optional in debug mode)'
                }
              },
              required: ['value']
            }
          },
          {
            name: 'fpe_decrypt',
            description: FPEService.TOOL_DESCRIPTIONS.fpe_decrypt.description,
            inputSchema: {
              type: 'object',
              properties: {
                value: {
                  type: 'string',
                  description: FPEService.TOOL_DESCRIPTIONS.fpe_decrypt.inputDescription
                },
                user_token: {
                  type: 'string',
                  description: 'Authentication token (required in test/production modes, optional in debug mode)'
                }
              },
              required: ['value']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const timestamp = new Date().toISOString();
      
      console.log(`\n📥 [STDIO] [${timestamp}] Tool call received:`);
      console.log(`   Tool: ${name}`);
      console.log(`   Args: ${JSON.stringify(args, null, 2)}`);

      try {        
        switch (name) {
          case 'fpe_encrypt': {
            console.log(`🔐 [STDIO] Checking authorization for fpe_encrypt...`);
            authorizeOrThrow(args); // Drop-in auth gate
            console.log(`✅ [STDIO] Authorization successful for fpe_encrypt`);
            
            if (!args?.value) {
              console.log(`❌ [STDIO] Missing required parameter: value`);
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: value');
            }
            
            console.log(`🔒 [STDIO] Encrypting value: ${args.value}`);
            const encrypted = fpeService.encrypt(args.value as string);
            console.log(`✅ [STDIO] Encryption successful: ${encrypted}`);
            return {
              content: [
                {
                  type: 'text',
                  text: `Encrypted: ${encrypted}\nAuth Mode: ${AUTH_MODE}\nNote: ENC_FPE: prefix indicates FF3-encrypted digits (no formatting preserved)`
                }
              ]
            };
          }

          case 'fpe_decrypt': {
            console.log(`🔐 [STDIO] Checking authorization for fpe_decrypt...`);
            authorizeOrThrow(args); // Drop-in auth gate
            console.log(`✅ [STDIO] Authorization successful for fpe_decrypt`);
            
            if (!args?.value) {
              console.log(`❌ [STDIO] Missing required parameter: value`);
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: value');
            }
            
            console.log(`🔓 [STDIO] Decrypting value: ${args.value}`);
            const decrypted = fpeService.decrypt(args.value as string);
            console.log(`✅ [STDIO] Decryption successful: ${decrypted}`);
            return {
              content: [
                {
                  type: 'text',
                  text: `Decrypted: ${decrypted}\nAuth Mode: ${AUTH_MODE}`
                }
              ]
            };
          }

          default:
            console.log(`❌ [STDIO] Unknown tool requested: ${name}`);
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.log(`🚨 [STDIO] Tool execution error:`, error);
        if (error instanceof McpError) {
          console.log(`   MCP Error Code: ${error.code}, Message: ${error.message}`);
          throw error;
        }
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   Error Message: ${msg}`);
        // Map validation errors to proper JSON-RPC codes
        if (/FPE radix-10 requires|FPE length must be/.test(msg)) {
          console.log(`   Mapped to InvalidParams error`);
          throw new McpError(ErrorCode.InvalidParams, msg);
        }
        console.log(`   Mapped to InternalError`);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${msg}`);
      }
    });
  }


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Log startup info to stderr (won't interfere with MCP protocol)
    console.error(`🚀 FPE Demo MCP Server started`);
    console.error(`📋 Auth Mode: ${AUTH_MODE}`);
    console.error(`🔧 Available Tools: fpe_encrypt, fpe_decrypt`);
    if (AUTH_MODE === 'debug') {
      console.error(`💡 FPE Demo MCP (stdio) ready. Try: tools/call fpe_encrypt { value:'123-45-6789' }`);
    } else {
      console.error(`💡 Tip: Set AUTH_MODE=debug for open access, or AUTH_MODE=test to try different user roles`);
    }
  }
}

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  server.run().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}

export { MCPServer };