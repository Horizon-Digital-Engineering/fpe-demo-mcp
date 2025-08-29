// AuthService test - Test all authentication modes with current system

import { spawn, ChildProcess } from 'child_process';

interface TestCase {
  description: string;
  tool: string;
  args: any;
  shouldSucceed: boolean;
}

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

function testMode(authMode: string, testCases: TestCase[]): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n=== Testing ${authMode.toUpperCase()} Mode ===`);
    
    const env = { ...process.env, AUTH_MODE: authMode, AUTH_TOKEN: 'demo-secret' };
    const server: ChildProcess = spawn('node', ['dist/src/stdio-server.js'], { env });
    
    server.stderr?.on('data', (data) => {
      console.log('Server:', data.toString().trim());
    });
    
    let requestId = 1;
    let testIndex = 0;
    let responses: any[] = [];
    
    function sendRequest(method: string, params?: any): void {
      const request: MCPRequest = {
        jsonrpc: "2.0", 
        id: requestId++,
        method,
        params
      };
      console.log(`\nSending: ${JSON.stringify(request)}`);
      server.stdin?.write(JSON.stringify(request) + '\n');
    }
    
    server.stdout?.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            responses.push(response);
            console.log('Response:', JSON.stringify(response, null, 2));
          } catch (e) {
            console.log('Non-JSON response:', line);
          }
        }
      });
    });
    
    setTimeout(() => {
      // Initialize
      sendRequest('initialize', {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "auth-test", version: "1.0" }
      });
      
      // Wait for initialization then run test cases
      setTimeout(() => {
        const runNextTest = () => {
          if (testIndex >= testCases.length) {
            // All tests done, cleanup
            setTimeout(() => {
              server.kill();
              resolve();
            }, 1000);
            return;
          }
          
          const testCase = testCases[testIndex];
          console.log(`\n--- Test Case ${testIndex + 1}: ${testCase.description} ---`);
          console.log(`Expected: ${testCase.shouldSucceed ? 'SUCCESS' : 'FAILURE'}`);
          
          sendRequest('tools/call', {
            name: testCase.tool,
            arguments: testCase.args
          });
          
          testIndex++;
          setTimeout(runNextTest, 1500); // Wait between tests
        };
        
        runNextTest();
      }, 1000);
      
    }, 200);
  });
}

async function runAllTests() {
  console.log('=== AuthService Authentication Mode Tests ===\n');
  
  // Test AUTHLESS mode (should always succeed)
  await testMode('authless', [
    {
      description: 'Encrypt without token (should work)',
      tool: 'fpe_encrypt',
      args: { value: '123456789' },
      shouldSucceed: true
    },
    {
      description: 'Decrypt without token (should work)', 
      tool: 'fpe_decrypt',
      args: { value: 'ENC_FPE:096616337' },
      shouldSucceed: true
    }
  ]);
  
  // Test DEBUG mode (should always succeed with any token)
  await testMode('debug', [
    {
      description: 'Encrypt without token (should work)',
      tool: 'fpe_encrypt',
      args: { value: '987654321' },
      shouldSucceed: true
    },
    {
      description: 'Encrypt with any token (should work)',
      tool: 'fpe_encrypt',
      args: { value: '555123456', user_token: 'any-token' },
      shouldSucceed: true
    }
  ]);
  
  // Test TEST mode (requires valid shared secret or JWT)
  await testMode('test', [
    {
      description: 'Encrypt with correct shared secret (should work)',
      tool: 'fpe_encrypt',
      args: { value: '111223333', user_token: 'demo-secret' },
      shouldSucceed: true
    },
    {
      description: 'Encrypt with wrong shared secret (should fail)',
      tool: 'fpe_encrypt',
      args: { value: '444556666', user_token: 'wrong-secret' },
      shouldSucceed: false
    },
    {
      description: 'Encrypt without token (should fail)',
      tool: 'fpe_encrypt',
      args: { value: '777889999' },
      shouldSucceed: false
    }
  ]);
  
  // Test PRODUCTION mode (requires valid JWT only)
  await testMode('production', [
    {
      description: 'Encrypt without token (should fail)',
      tool: 'fpe_encrypt',
      args: { value: '123123123' },
      shouldSucceed: false
    },
    {
      description: 'Encrypt with shared secret (should fail - JWT required)',
      tool: 'fpe_encrypt',
      args: { value: '456456456', user_token: 'demo-secret' },
      shouldSucceed: false
    },
    {
      description: 'Encrypt with invalid JWT (should fail)',
      tool: 'fpe_encrypt', 
      args: { value: '789789789', user_token: 'Bearer invalid-jwt' },
      shouldSucceed: false
    }
  ]);
  
  console.log('\n=== AuthService Tests Complete ===');
  console.log('Note: This test validates auth modes work as expected.');
  console.log('Success/failure validation requires manual review of output.');
}

// Run the tests
runAllTests().catch(console.error);