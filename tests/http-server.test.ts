/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

// HTTP MCP Server test for the MCP-compliant Streamable HTTP server

import { spawn, ChildProcess } from 'child_process';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

class HTTPMCPClient {
  private baseUrl: string;
  private sessionId: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl;
    this.sessionId = ''; // Will be set by server on first request
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    const url = `${this.baseUrl}/mcp`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'  // Required by StreamableHTTPServerTransport
    };
    
    // Don't send session ID on first request - let server generate it
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${text ? ` — ${text}` : ''}`);
    }

    // Capture session ID from response header for subsequent requests
    const responseSessionId = response.headers.get('Mcp-Session-Id') || 
                              response.headers.get('MCP-Session-ID') || 
                              response.headers.get('mcp-session-id');
    if (responseSessionId) {
      this.sessionId = responseSessionId;
    }

    // Handle SSE response format
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      // Parse SSE format: look for "data: " line
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonData = line.slice(6); // Remove "data: " prefix
          return JSON.parse(jsonData);
        }
      }
      throw new Error('No data found in SSE response');
    } else {
      return await response.json();
    }
  }

  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return await response.json();
  }

  async cleanup(): Promise<void> {
    // No explicit cleanup needed for MCP Streamable HTTP
    // Sessions are managed automatically by the server
  }
}

// Test the HTTP MCP server
async function testHTTPServer(): Promise<void> {
  console.log('=== Testing MCP HTTP Server ===\n');

  // Start the HTTP server
  console.log('Starting HTTP server...');
  const serverProcess = spawn('node', ['dist/src/http-server.js'], {
    env: { ...process.env, AUTH_MODE: 'authless', PORT: '8765' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Log server output for debugging
  serverProcess.stdout?.on('data', (data) => {
    console.log('Server:', data.toString().trim());
  });
  
  serverProcess.stderr?.on('data', (data) => {
    console.error('Server error:', data.toString().trim());
  });

  // Wait longer for server to start
  console.log('Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const client = new HTTPMCPClient();

  try {
    // 1. Health check
    console.log('1. Health check...');
    const health = await client.healthCheck();
    console.log(`Server status: ${health.status}, auth_mode: ${health.auth_mode}\n`);

    // 2. Initialize session first (required for HTTP transport)
    console.log('2. Initializing session...');
    const initResponse = await client.sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'http-test', version: '1.0' }
      }
    });
    console.log('Initialized:', initResponse.result ? '✅' : '❌');
    console.log();

    // 3. List tools
    console.log('3. List tools...');
    const toolsResponse = await client.sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    console.log('Tools available:', toolsResponse.result?.tools?.length || 0);
    if (toolsResponse.result?.tools) {
      toolsResponse.result.tools.forEach((tool: any) => {
        console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
      });
    }
    console.log();

    // 4. Test encrypt
    console.log('4. Test encrypt...');
    const encryptResponse = await client.sendRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'fpe_encrypt',
        arguments: { value: '123-45-6789' }
      }
    });
    
    // Extract the encrypted value from the response
    const encText = encryptResponse.result?.content?.[0]?.text || '';
    const match = encText.match(/Encrypted:\s*(ENC_FPE:\d+)/);
    if (!match) {
      throw new Error(`Didn't find ENC_FPE in: ${encText}`);
    }
    const encryptedValue = match[1];
    console.log('Encrypt response:', encText);
    console.log();

    // 5. Test decrypt (round-trip the encrypted value)
    console.log('5. Test decrypt...');
    const decryptResponse = await client.sendRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'fpe_decrypt',
        arguments: { value: encryptedValue }
      }
    });
    console.log('Decrypt response:', decryptResponse.result?.content?.[0]?.text || 'No content');
    console.log();

    // 6. Test error handling (short input)
    console.log('6. Test error handling (short input)...');
    try {
      const errorResponse = await client.sendRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'fpe_encrypt',
          arguments: { value: '123' }
        }
      });
      console.log('Error response:', errorResponse.error?.message || 'No error');
    } catch (error) {
      console.log('Caught error:', error instanceof Error ? error.message : error);
    }
    console.log();

    console.log('✅ HTTP MCP Server test completed successfully!');

  } catch (error) {
    console.error('❌ HTTP MCP Server test failed:', error);
    throw error;
  } finally {
    // Cleanup
    await client.cleanup();
    serverProcess.kill('SIGTERM');
    
    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testHTTPServer().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testHTTPServer };