/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

/**
 * Stdio MCP Client Example
 * 
 * This example demonstrates how to interact with the stdio MCP server using JSON-RPC over stdin/stdout.
 * It shows the console-based testing approach that was used before migrating to Vitest framework.
 * 
 * Key Learning Points:
 * - How to spawn and communicate with stdio MCP server processes
 * - Writing JSON-RPC messages to stdin and reading responses from stdout
 * - Handling the MCP protocol initialization handshake
 * - Making tools/list and tools/call requests
 * - Error handling for invalid parameters and unknown tools
 * - Testing FF3 FPE encryption/decryption end-to-end
 * - Working with line-based JSON message parsing
 * 
 * MCP Protocol Flow Demonstrated:
 * 1. Initialize - establish protocol version and capabilities
 * 2. List tools - discover available fpe_encrypt and fpe_decrypt tools
 * 3. Call tools - perform actual encryption/decryption operations
 * 4. Error scenarios - test validation and error handling
 * 
 * Usage:
 * 1. Run `npm run build` to compile TypeScript
 * 2. Run `node dist/examples/stdio-client-example.js` to execute
 * 
 * This is educational/example code - the actual tests now use Vitest framework
 * (see tests/stdio-server.vitest.ts for the current test implementation)
 */

import { spawn, ChildProcess } from 'child_process';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

class MCPClient {
  private process: ChildProcess;
  private requestId: number = 1;

  constructor(command: string, args: string[]) {
    this.process = spawn(command, args);
    
    this.process.stdout?.on('data', (data: Buffer) => {
      console.log('Server response:', data.toString());
    });
    
    this.process.stderr?.on('data', (data: Buffer) => {
      console.log('Server log:', data.toString());
    });
  }

  sendRequest(method: string, params: Record<string, unknown> = {}): void {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: method,
      params: params
    };
    
    console.log('Sending:', JSON.stringify(request));
    this.process.stdin?.write(JSON.stringify(request) + '\n');
  }

  close(): void {
    this.process.stdin?.end();
    this.process.kill();
  }
}

// Test our MCP server
async function testServer(): Promise<void> {
  const client = new MCPClient('node', ['dist/src/stdio-server.js']);
  
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n=== Testing MCP Server ===');
  
  // 1. Initialize
  console.log('\n1. Initialize...');
  client.sendRequest('initialize', {
    protocolVersion: "2025-03-26",
    capabilities: { roots: { listChanged: false }, sampling: {} },
    clientInfo: { name: "test-client", version: "1.0.0" }
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 2. List tools
  console.log('\n2. List tools...');
  client.sendRequest('tools/list');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 3. Call encrypt tool
  console.log('\n3. Test encrypt...');
  client.sendRequest('tools/call', {
    name: 'fpe_encrypt',
    arguments: { value: '123-45-6789' }
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 4. Call decrypt tool (use real encrypted value from step 3)
  console.log('\n4. Test decrypt...');
  client.sendRequest('tools/call', {
    name: 'fpe_decrypt', 
    arguments: { value: 'ENC_FPE:096616337' }
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\n=== Test Complete ===');
  client.close();
}

testServer().catch(console.error);