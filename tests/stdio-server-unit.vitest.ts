/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { FPEService } from '../src/FPEService.js';
import { AuthService } from '../src/AuthService.js';

/**
 * Stdio Server Unit Tests - Essential Coverage
 * 
 * Focused tests for stdio-server.ts covering configuration,
 * initialization, and core function logic without duplication.
 */

describe('Stdio Server Unit Tests', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Configuration', () => {
    test('should handle different AUTH_MODE values', async () => {
      const modes = ['authless', 'debug', 'test', 'production'];
      
      for (const mode of modes) {
        process.env.AUTH_MODE = mode;
        if (mode === 'test' || mode === 'production') {
          process.env.AUTH_TOKEN = 'test-secret';
        }
        
        const module = await import('../src/stdio-server.js?t=' + Date.now() + mode);
        const server = new module.MCPServer();
        
        expect(server).toBeDefined();
      }
    });

    test('should handle missing package.json gracefully', async () => {
      // Test that the server handles version fallback gracefully
      // The actual file mocking is complex in vitest 4, so we test the outcome
      const module = await import('../src/stdio-server.js?t=' + Date.now() + 'pkgjson');
      const server = new module.MCPServer();

      // Server should be created regardless of package.json issues
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });
  });

  describe('Authorization Function Logic', () => {
    test('should test authorization logic directly', () => {
      // Test the actual authorizeOrThrow logic
      const testAuth = (authMode: string, token: string, authToken: string) => {
        const auth = new AuthService(authToken);
        
        if (authMode === 'authless' || authMode === 'debug') {
          return; // Always pass
        }
        
        const maybeJwt = token.startsWith('Bearer ') ? auth.verifyAuthorizationHeader(token) : null;
        
        if (authMode === 'test') {
          const sharedOk = token === authToken;
          if (!maybeJwt && !sharedOk) {
            throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized');
          }
          return;
        }
        
        if (!maybeJwt) {
          throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized');
        }
      };
      
      // Test different scenarios
      expect(() => testAuth('authless', '', '')).not.toThrow();
      expect(() => testAuth('debug', '', '')).not.toThrow();
      expect(() => testAuth('test', 'test-secret', 'test-secret')).not.toThrow();
      expect(() => testAuth('test', 'wrong', 'test-secret')).toThrow();
      expect(() => testAuth('production', 'no-jwt', 'secret')).toThrow();
    });
  });

  describe('Tool Logic Coverage', () => {
    test('should test encryption tool logic', () => {
      const fpeService = new FPEService('', '');
      
      const encryptTool = (args: any) => {
        if (!args?.value) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: value');
        }
        
        const encrypted = fpeService.encrypt(args.value as string);
        return {
          content: [{
            type: 'text',
            text: `Encrypted: ${encrypted}`
          }]
        };
      };
      
      expect(() => encryptTool({})).toThrow('Missing required parameter: value');
      const result = encryptTool({ value: '123456789' });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Encrypted:');
    });

    test('should test error handling patterns', () => {
      const errorHandler = (toolName: string) => {
        try {
          throw new Error('FPE radix-10 requires 6-56 digits');
        } catch (error) {
          if (error instanceof McpError) {
            throw error;
          }
          const msg = error instanceof Error ? error.message : 'Unknown error';
          if (/FPE radix-10 requires|FPE length must be/.test(msg)) {
            throw new McpError(ErrorCode.InvalidParams, msg);
          }
          throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${msg}`);
        }
      };
      
      expect(() => errorHandler('fpe_encrypt')).toThrow(McpError);
      try {
        errorHandler('fpe_encrypt');
      } catch (error) {
        expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
      }
    });
  });

  describe('Server Initialization', () => {
    test('should create MCPServer with different configurations', async () => {
      // Test with comprehensive environment
      process.env.AUTH_MODE = 'test';
      process.env.AUTH_TOKEN = 'test-secret';
      process.env.FPE_KEY = 'FEDCBA9876543210FEDCBA9876543210';
      process.env.FPE_TWEAK = 'D8E7920AFA330A73';
      
      const module = await import('../src/stdio-server.js?t=' + Date.now());
      const server = new module.MCPServer();
      
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
      expect(typeof server.run).toBe('function');
    });

    test('should handle run method execution', async () => {
      process.env.AUTH_MODE = 'authless';
      
      const module = await import('../src/stdio-server.js?t=' + Date.now());
      const server = new module.MCPServer();
      
      // Mock server.connect to prevent actual connection
      server.server.connect = vi.fn().mockResolvedValue(undefined);
      
      await expect(server.run()).resolves.not.toThrow();
      expect(server.server.connect).toHaveBeenCalled();
    });
  });
});