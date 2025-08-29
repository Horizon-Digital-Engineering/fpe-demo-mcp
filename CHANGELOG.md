# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - TBD

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
- Enterprise-ready security patterns
- Proper token validation and error handling
- No secrets exposed in logs or responses