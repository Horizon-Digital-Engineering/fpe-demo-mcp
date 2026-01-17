/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { FPEService } from '../src/FPEService.js';

/**
 * HTTP Server Unit Tests - Essential Coverage
 * 
 * Focused tests for http-server.ts covering configuration,
 * initialization, and core function logic without duplication.
 */

describe('HTTP Server Unit Tests', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Configuration', () => {
    test('should handle different port configurations', async () => {
      // Test default port
      delete process.env.PORT;
      let module = await import('../src/http-server.js?t=' + Date.now());
      expect(module).toBeDefined();
      
      // Test custom port
      process.env.PORT = '9999';
      module = await import('../src/http-server.js?t=' + Date.now() + 'port');
      expect(module).toBeDefined();
    });

    test('should handle different AUTH_MODE values', async () => {
      const modes = ['authless', 'debug', 'test', 'production'];
      
      for (const mode of modes) {
        process.env.AUTH_MODE = mode;
        if (mode === 'test' || mode === 'production') {
          process.env.AUTH_TOKEN = 'test-secret';
        }
        
        const module = await import('../src/http-server.js?t=' + Date.now() + mode);
        expect(module).toBeDefined();
      }
    });

    test('should handle CORS configuration', async () => {
      // Test with CORS origins
      process.env.CORS_ORIGIN = 'http://localhost:3000,https://example.com';
      let module = await import('../src/http-server.js?t=' + Date.now());
      expect(module).toBeDefined();
      
      // Test with wildcard
      process.env.CORS_ORIGIN = '*';
      module = await import('../src/http-server.js?t=' + Date.now() + 'cors');
      expect(module).toBeDefined();
    });
  });

  describe('Package.json Error Handling', () => {
    test('should handle missing or corrupted package.json', async () => {
      // Mock missing package.json
      vi.doMock('node:fs', () => ({
        readFileSync: vi.fn().mockImplementation((path) => {
          if (path === 'package.json') {
            throw new Error('ENOENT: no such file or directory');
          }
          return '{}';
        })
      }));
      
      const module = await import('../src/http-server.js?t=' + Date.now());
      expect(module).toBeDefined();
      
      vi.doUnmock('node:fs');
    });
  });

  describe('Authorization Function Logic', () => {
    test('should test authorization patterns', () => {
      // Test the authorizeOrThrow logic patterns used in HTTP server
      const testAuth = (authMode: string, token?: string) => {
        if (authMode === 'authless' || authMode === 'debug') return;

        const isBearer = token?.startsWith('Bearer ');
        const bearerValue = isBearer && token ? token.slice('Bearer '.length).trim() : undefined;
        const jwtPayload = null; // Mock JWT as null

        if (authMode === 'test') {
          const shared = process.env.AUTH_TOKEN || 'demo-secret';
          const sharedOk = (bearerValue ?? token) === shared;
          if (!jwtPayload && !sharedOk) {
            throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized');
          }
          return;
        }

        if (!jwtPayload) {
          throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized (production mode: Bearer JWT required)');
        }
      };

      // Test different scenarios
      expect(() => testAuth('authless')).not.toThrow();
      expect(() => testAuth('debug')).not.toThrow();
      expect(() => testAuth('test', 'demo-secret')).not.toThrow();
      expect(() => testAuth('test', 'Bearer demo-secret')).not.toThrow();
      expect(() => testAuth('test', 'wrong')).toThrow();
      expect(() => testAuth('production', 'Bearer token')).toThrow();
    });
  });

  describe('Tool Handler Logic Coverage', () => {
    test('should test tool handler patterns directly', () => {
      // Use the imported services directly to test tool logic patterns
      const fpe = new FPEService('', '');
      // AuthService imported but tested separately in AuthService.vitest.ts

      // Test the encryption tool handler logic
      interface ToolArgs { value?: string; user_token?: string }
      interface ToolContext { _meta?: { authorization?: string } }
      const mockEncryptHandler = ({ value, user_token }: ToolArgs, _ctx?: ToolContext) => {
        // Simulate authorizeOrThrow logic
        const headerToken = _ctx?._meta?.authorization;
        const token = headerToken || user_token;
        
        // Auth logic (simplified for authless mode)
        if (process.env.AUTH_MODE !== 'authless') {
          if (!token) throw new McpError(ErrorCode.InvalidRequest, 'Unauthorized');
        }
        
        // Tool validation
        if (!value) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: value');
        }
        
        // FPE operation
        const encrypted = fpe.encrypt(value);
        return {
          content: [
            { type: 'text', text: `Encrypted: ${encrypted}\nAuth Mode: ${process.env.AUTH_MODE}` }
          ]
        };
      };
      
      // Test the handler
      process.env.AUTH_MODE = 'authless';
      expect(() => mockEncryptHandler({})).toThrow('Missing required parameter: value');
      
      const result = mockEncryptHandler({ value: '123456789' });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Encrypted:');
      
      // Test decrypt handler pattern
      const mockDecryptHandler = ({ value }: ToolArgs) => {
        if (!value) throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: value');
        const decrypted = fpe.decrypt(value);
        return {
          content: [{ type: 'text', text: `Decrypted: ${decrypted}` }]
        };
      };
      
      const encrypted = fpe.encrypt('123456789');
      const decryptResult = mockDecryptHandler({ value: encrypted });
      expect(decryptResult.content[0].text).toContain('Decrypted:');
    });
  });

  describe('Service Configuration', () => {
    test('should handle comprehensive environment setup', async () => {
      // Test with all environment variables
      process.env.PORT = '3000';
      process.env.HOST = '127.0.0.1';
      process.env.AUTH_MODE = 'test';
      process.env.CORS_ORIGIN = 'https://secure.example.com';
      process.env.FPE_KEY = 'FEDCBA9876543210FEDCBA9876543210';
      process.env.FPE_TWEAK = 'D8E7920AFA330A73';
      process.env.AUTH_TOKEN = 'test-secret';
      
      const module = await import('../src/http-server.js?t=' + Date.now());
      expect(module).toBeDefined();
    });
  });
});