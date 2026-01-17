# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-01-16

### Changed
- **BREAKING**: Minimum Node.js version increased from 18 to 20
- Migrated from console-based tests to Vitest 4.x framework
- Improved test coverage: FPEService to 97.4%, AuthService to 100%
- Reorganized test structure with 69 comprehensive tests
- Moved old console tests to examples/ as client interaction demos
- Enhanced HTTP server test reliability with sequential file execution

### Added
- `/version` endpoint on HTTP server returning name, version, node version, and uptime
- Comprehensive error handling tests for edge cases
- Client examples showing how to interact with both stdio and HTTP servers
- Proper TypeScript typing throughout (removed all `any` types)

### Updated
- zod: 3.25.76 → 4.3.5 (major version upgrade)
- @modelcontextprotocol/sdk: 1.21.1 → 1.25.2
- vitest: 3.2.4 → 4.0.17
- @vitest/coverage-v8: 3.2.4 → 4.0.17
- typescript: 5.8.3 → 5.9.3
- Various other dependency updates

### Security
- Resolved all 8 Dependabot security alerts through dependency updates

## [1.0.0] - 2025-08-30

### Added
- Complete MCP (Model Context Protocol) server implementation
- FF3 Format Preserving Encryption with real cryptography (6-56 digits, radix-10)
- Multi-mode authentication system (authless, debug, test, production)
- JWT and shared secret authentication support  
- Both stdio and HTTP transport protocols
- Comprehensive test suite covering FPE, authentication, and both transports
- DigitalOcean App Platform deployment with one-click button
- Enhanced logging and debugging throughout
- Complete TypeScript implementation with proper error handling
- `ENC_FPE:` tagged encrypted values for easy identification
- Universal MCP client compatibility (Claude, ChatGPT, etc.)
- Extensive documentation including architecture, deployment, and usage guides
- Business Source License 1.1 (BUSL-1.1) licensing
- Professional README badges for version, license, Node.js, and TypeScript
- GitHub Actions CI/CD workflow with Node.js 18 and 20 testing
- ESLint configuration with TypeScript support and demo-friendly rules
- Dependabot configuration for automated dependency updates
- Enhanced package.json metadata with bugs URL and additional keywords
- This CHANGELOG.md following Keep a Changelog format

### Security
- Demo security patterns
- Proper token validation and error handling
- No secrets exposed in logs or responses