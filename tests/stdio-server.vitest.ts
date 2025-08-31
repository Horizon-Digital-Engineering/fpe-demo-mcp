/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';

describe('MCPServer - stdio-server', () => {
  let originalAuthMode: string | undefined;

  beforeEach(() => {
    originalAuthMode = process.env.AUTH_MODE;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.AUTH_MODE = originalAuthMode;
  });

  const sendJsonRpc = (child: any, method: string, params?: any, id = 1) => {
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    child.stdin.write(JSON.stringify(request) + '\n');
  };

  describe('integration tests via spawn', () => {
    test('should handle initialize request', async () => {
      const child = spawn('node', ['dist/src/stdio-server.js'], {
        env: { ...process.env, AUTH_MODE: 'authless' }
      });

      const result = await new Promise<any>((resolve, reject) => {
        let responseReceived = false;

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              if (response.result && response.result.serverInfo) {
                responseReceived = true;
                child.kill();
                resolve(response);
                return;
              }
            } catch (e) {
              // Ignore non-JSON lines (server logs)
            }
          }
        });

        child.on('error', (err) => {
          if (!responseReceived) {
            reject(new Error(`Child process error: ${err.message}`));
          }
        });

        setTimeout(() => {
          sendJsonRpc(child, 'initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
          });
        }, 100);

        setTimeout(() => {
          if (!responseReceived) {
            child.kill();
            reject(new Error('Initialize request timed out'));
          }
        }, 5000);
      });

      expect(result.result.serverInfo.name).toBe('fpe-demo-mcp');
      expect(result.result.serverInfo.version).toBeDefined();
    }, 10000);

    test('should handle tools/list request', async () => {
      const child = spawn('node', ['dist/src/stdio-server.js'], {
        env: { ...process.env, AUTH_MODE: 'authless' }
      });

      const result = await new Promise<any>((resolve, reject) => {
        let initDone = false;
        let listReceived = false;

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              
              if (response.result && response.result.serverInfo && !initDone) {
                initDone = true;
                // Send tools/list after initialize
                setTimeout(() => {
                  sendJsonRpc(child, 'tools/list', {}, 2);
                }, 100);
              } else if (response.result && response.result.tools && !listReceived) {
                listReceived = true;
                child.kill();
                resolve(response);
                return;
              }
            } catch (e) {
              // Ignore non-JSON lines
            }
          }
        });

        child.on('error', (err) => {
          if (!listReceived) {
            reject(new Error(`Child process error: ${err.message}`));
          }
        });

        setTimeout(() => {
          sendJsonRpc(child, 'initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
          });
        }, 100);

        setTimeout(() => {
          if (!listReceived) {
            child.kill();
            reject(new Error('Tools/list request timed out'));
          }
        }, 10000);
      });

      expect(Array.isArray(result.result.tools)).toBe(true);
      expect(result.result.tools.length).toBe(2);
      expect(result.result.tools[0].name).toBe('fpe_encrypt');
      expect(result.result.tools[1].name).toBe('fpe_decrypt');
    }, 15000);

    test('should handle missing parameter error', async () => {
      const child = spawn('node', ['dist/src/stdio-server.js'], {
        env: { ...process.env, AUTH_MODE: 'authless' }
      });

      const result = await new Promise<any>((resolve, reject) => {
        let initDone = false;
        let errorReceived = false;

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              
              if (response.result && response.result.serverInfo && !initDone) {
                initDone = true;
                // Send tools/call without value parameter
                setTimeout(() => {
                  sendJsonRpc(child, 'tools/call', {
                    name: 'fpe_encrypt',
                    arguments: {} // Missing value parameter
                  }, 2);
                }, 100);
              } else if (response.error && !errorReceived) {
                errorReceived = true;
                child.kill();
                resolve(response);
                return;
              }
            } catch (e) {
              // Ignore non-JSON lines
            }
          }
        });

        child.on('error', (err) => {
          if (!errorReceived) {
            reject(new Error(`Child process error: ${err.message}`));
          }
        });

        setTimeout(() => {
          sendJsonRpc(child, 'initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
          });
        }, 100);

        setTimeout(() => {
          if (!errorReceived) {
            child.kill();
            reject(new Error('Missing parameter test timed out'));
          }
        }, 10000);
      });

      expect(result.error.code).toBe(-32602); // InvalidParams
      expect(result.error.message).toContain('Missing required parameter: value');
    }, 15000);

    test('should handle unknown tool error', async () => {
      const child = spawn('node', ['dist/src/stdio-server.js'], {
        env: { ...process.env, AUTH_MODE: 'authless' }
      });

      const result = await new Promise<any>((resolve, reject) => {
        let initDone = false;
        let errorReceived = false;

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              
              if (response.result && response.result.serverInfo && !initDone) {
                initDone = true;
                // Send call to unknown tool
                setTimeout(() => {
                  sendJsonRpc(child, 'tools/call', {
                    name: 'unknown_tool',
                    arguments: { value: 'test' }
                  }, 2);
                }, 100);
              } else if (response.error && !errorReceived) {
                errorReceived = true;
                child.kill();
                resolve(response);
                return;
              }
            } catch (e) {
              // Ignore non-JSON lines
            }
          }
        });

        child.on('error', (err) => {
          if (!errorReceived) {
            reject(new Error(`Child process error: ${err.message}`));
          }
        });

        setTimeout(() => {
          sendJsonRpc(child, 'initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
          });
        }, 100);

        setTimeout(() => {
          if (!errorReceived) {
            child.kill();
            reject(new Error('Unknown tool test timed out'));
          }
        }, 10000);
      });

      expect(result.error.code).toBe(-32601); // MethodNotFound
      expect(result.error.message).toContain('Unknown tool: unknown_tool');
    }, 15000);

    test('should handle successful encryption/decryption', async () => {
      const child = spawn('node', ['dist/src/stdio-server.js'], {
        env: { ...process.env, AUTH_MODE: 'authless' }
      });

      const results = await new Promise<any[]>((resolve, reject) => {
        let initDone = false;
        let encryptDone = false;
        let decryptDone = false;
        let encryptedValue = '';
        const responses: any[] = [];

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              
              if (response.result && response.result.serverInfo && !initDone) {
                initDone = true;
                // Send encrypt request
                setTimeout(() => {
                  sendJsonRpc(child, 'tools/call', {
                    name: 'fpe_encrypt',
                    arguments: { value: '123456789' }
                  }, 2);
                }, 100);
              } else if (response.result && response.result.content && !encryptDone && response.id === 2) {
                const text = response.result.content[0].text;
                // Extract encrypted value for decryption test
                const match = text.match(/ENC_FPE:\d+/);
                if (match) {
                  encryptedValue = match[0];
                  encryptDone = true;
                  responses.push(response);
                  
                  // Send decrypt request
                  setTimeout(() => {
                    sendJsonRpc(child, 'tools/call', {
                      name: 'fpe_decrypt',
                      arguments: { value: encryptedValue }
                    }, 3);
                  }, 100);
                }
              } else if (response.result && response.result.content && encryptDone && !decryptDone && response.id === 3) {
                decryptDone = true;
                responses.push(response);
                child.kill();
                resolve(responses);
                return;
              }
            } catch (e) {
              // Ignore non-JSON lines
            }
          }
        });

        child.on('error', (err) => {
          if (!decryptDone) {
            reject(new Error(`Child process error: ${err.message}`));
          }
        });

        setTimeout(() => {
          sendJsonRpc(child, 'initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
          });
        }, 100);

        setTimeout(() => {
          if (!decryptDone) {
            child.kill();
            reject(new Error('Encryption/decryption test timed out'));
          }
        }, 15000);
      });

      // Check encrypt response
      expect(results[0].result.content[0].text).toContain('Encrypted:');
      expect(results[0].result.content[0].text).toContain('ENC_FPE:');
      
      // Check decrypt response
      expect(results[1].result.content[0].text).toContain('Decrypted: 123456789');
    }, 20000);
  });
});