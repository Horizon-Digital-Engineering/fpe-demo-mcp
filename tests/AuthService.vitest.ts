/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../src/AuthService.js';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let originalAuthMode: string | undefined;

  beforeEach(() => {
    originalAuthMode = process.env.AUTH_MODE;
  });

  afterEach(() => {
    process.env.AUTH_MODE = originalAuthMode;
  });

  describe('constructor', () => {
    test('should use provided secret', () => {
      const customAuth = new AuthService('custom-secret');
      expect(customAuth).toBeDefined();
    });

    test('should use default secret when none provided', () => {
      const defaultAuth = new AuthService();
      expect(defaultAuth).toBeDefined();
    });
  });

  describe('verifyAuthorizationHeader - authless mode', () => {
    test('should always return true in authless mode', () => {
      process.env.AUTH_MODE = 'authless';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader()).toBe(true);
      expect(auth.verifyAuthorizationHeader('Bearer token')).toBe(true);
      expect(auth.verifyAuthorizationHeader('invalid')).toBe(true);
    });
  });

  describe('verifyAuthorizationHeader - debug mode', () => {
    test('should return true for any Bearer token in debug mode', () => {
      process.env.AUTH_MODE = 'debug';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer anything')).toBe(true);
      expect(auth.verifyAuthorizationHeader('Bearer test')).toBe(true);
    });

    test('should return false for non-Bearer tokens in debug mode', () => {
      process.env.AUTH_MODE = 'debug';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('invalid-format')).toBe(false);
      expect(auth.verifyAuthorizationHeader()).toBe(false);
    });
  });

  describe('verifyAuthorizationHeader - test mode', () => {
    test('should accept valid shared secret', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer test-secret')).toBe(true);
    });

    test('should reject wrong shared secret', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer wrong-secret')).toBe(false);
    });

    test('should accept valid JWT', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('jwt-secret');
      const validJWT = jwt.sign({ userId: 'test', role: 'user' }, 'jwt-secret', { algorithm: 'HS256' });
      
      const result = auth.verifyAuthorizationHeader(`Bearer ${validJWT}`);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('object'); // Should return JWT payload
    });

    test('should reject invalid JWT', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('wrong-secret');
      const jwt = 'invalid.jwt.token';
      
      expect(auth.verifyAuthorizationHeader(`Bearer ${jwt}`)).toBe(false);
    });

    test('should return false for missing header', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader()).toBe(false);
    });
  });

  describe('verifyAuthorizationHeader - production mode', () => {
    test('should accept valid JWT', () => {
      process.env.AUTH_MODE = 'production';
      const auth = new AuthService('prod-secret');
      const validJWT = jwt.sign({ userId: 'prod', role: 'admin' }, 'prod-secret', { algorithm: 'HS256' });
      
      const result = auth.verifyAuthorizationHeader(`Bearer ${validJWT}`);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('object');
    });

    test('should reject shared secret in production mode', () => {
      process.env.AUTH_MODE = 'production';
      const auth = new AuthService('prod-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer prod-secret')).toBeFalsy();
    });

    test('should reject invalid JWT', () => {
      process.env.AUTH_MODE = 'production';
      const auth = new AuthService('wrong-secret');
      const validJWT = jwt.sign({ userId: 'test' }, 'different-secret', { algorithm: 'HS256' });
      
      expect(auth.verifyAuthorizationHeader(`Bearer ${validJWT}`)).toBeFalsy();
    });

    test('should reject malformed JWT', () => {
      process.env.AUTH_MODE = 'production';
      const auth = new AuthService('prod-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer invalid-jwt')).toBeFalsy();
    });
  });

  describe('invalid header formats', () => {
    test('should reject non-Bearer headers', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('Token xyz')).toBe(false);
      expect(auth.verifyAuthorizationHeader('Basic xyz')).toBe(false);
      expect(auth.verifyAuthorizationHeader('just-a-token')).toBe(false);
    });

    test('should reject empty Bearer token', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer')).toBe(false);
      expect(auth.verifyAuthorizationHeader('Bearer ')).toBe(false);
    });
  });

  describe('unknown auth mode', () => {
    test('should return false for unknown auth mode', () => {
      process.env.AUTH_MODE = 'unknown-mode';
      const auth = new AuthService('test-secret');
      
      expect(auth.verifyAuthorizationHeader('Bearer token')).toBe(false);
    });
  });

  describe('JWT precedence in test mode', () => {
    test('should prefer JWT over shared secret when both are valid', () => {
      process.env.AUTH_MODE = 'test';
      const auth = new AuthService('test-secret');
      
      // Create a JWT that would decode successfully
      const validJWT = jwt.sign({ userId: 'jwt-user', role: 'admin' }, 'test-secret', { algorithm: 'HS256' });
      
      const result = auth.verifyAuthorizationHeader(`Bearer ${validJWT}`);
      
      // Should return JWT payload, not just boolean true
      expect(result).toBeTruthy();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('userId', 'jwt-user');
    });
  });
});