// MCP Client test for testing the FPE server

import { spawn, ChildProcess } from 'child_process';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

class MCPClient {
  private process: ChildProcess;
  private requestId: number = 1;

  constructor(command: string, args: string[]) {
    this.process = spawn(command, args);
    
    this.process.stdout?.on('data', (data) => {
      console.log('Server response:', data.toString());
    });
    
    this.process.stderr?.on('data', (data) => {
      console.log('Server log:', data.toString());
    });
  }

  sendRequest(method: string, params: any = {}): void {
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