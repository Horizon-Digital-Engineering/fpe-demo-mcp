/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

// JWT-ready authentication with fallback to shared secret for demo modes
import jwt from 'jsonwebtoken';

export class AuthService {
  private secret: string;
  private jwtSecret: string;

  constructor(secret: string = 'demo-secret') {
    this.secret = secret;
    this.jwtSecret = process.env.AUTH_JWT_SECRET || secret; // Use AUTH_JWT_SECRET or fallback
  }

  /** Extract Bearer token from Authorization header */
  private extractBearer(authHeader?: string): string | null {
    console.log(`🔍 [AUTH] Extracting bearer token from header: ${authHeader ? authHeader.substring(0, 20) + '...' : 'undefined'}`);
    if (!authHeader) {
      console.log(`❌ [AUTH] No authorization header provided`);
      return null;
    }
    const [scheme, token] = authHeader.split(' ');
    if (!token || scheme.toLowerCase() !== 'bearer') {
      console.log(`❌ [AUTH] Invalid authorization format - expected 'Bearer <token>', got: ${scheme}`);
      return null;
    }
    console.log(`✅ [AUTH] Successfully extracted bearer token: ${token.substring(0, 10)}...`);
    return token;
  }

  /** Verify JWT token and return payload (null if invalid) */
  public verifyJwt(token: string): any | null {
    console.log(`🔐 [AUTH] Attempting JWT verification with token: ${token.substring(0, 20)}...`);
    try {
      const payload = jwt.verify(token, this.jwtSecret, { 
        algorithms: ['HS256'],
        ...(process.env.AUTH_JWT_ISS ? { issuer: process.env.AUTH_JWT_ISS } : {}),
        ...(process.env.AUTH_JWT_AUD ? { audience: process.env.AUTH_JWT_AUD } : {}),
        clockTolerance: 5
      });
      console.log(`✅ [AUTH] JWT verification successful:`, payload);
      return payload;
    } catch (error) {
      console.log(`❌ [AUTH] JWT verification failed:`, error instanceof Error ? error.message : error);
      return null; // Invalid JWT
    }
  }


  /** 
   * Extract Bearer token and verify (returns payload for JWT, true for shared secret)
   * Supports all auth modes: authless, debug, test, production
   */
  verifyAuthorizationHeader(authHeader?: string): any | boolean {
    const authMode = process.env.AUTH_MODE || 'authless';
    console.log(`🔐 [AUTH] Authorization header verification - Mode: ${authMode}`);
    
    // In authless mode, always allow (no token needed)
    if (authMode === 'authless') {
      console.log(`✅ [AUTH] Authless mode - access granted without token`);
      return true;
    }
    
    const token = this.extractBearer(authHeader);
    if (!token) {
      console.log(`❌ [AUTH] No bearer token found in authorization header`);
      return false;
    }
    
    // In debug mode, return true for any token
    if (authMode === 'debug') {
      console.log(`✅ [AUTH] Debug mode - accepting any bearer token`);
      return true;
    }
    
    // In test mode, try JWT first, then shared secret
    if (authMode === 'test') {
      const jwtPayload = this.verifyJwt(token);
      if (jwtPayload) {
        console.log(`✅ [AUTH] Test mode - JWT verification successful`);
        return jwtPayload;
      }
      const isSharedSecret = token === this.secret;
      console.log(`${isSharedSecret ? '✅' : '❌'} [AUTH] Test mode - Shared secret verification: ${isSharedSecret}`);
      return isSharedSecret;
    }
    
    // In production mode, require valid JWT
    if (authMode === 'production') {
      const result = this.verifyJwt(token);
      console.log(`${result ? '✅' : '❌'} [AUTH] Production mode - JWT verification: ${!!result}`);
      return result;
    }
    
    console.log(`❌ [AUTH] Unknown auth mode: ${authMode}`);
    return false;
  }
}