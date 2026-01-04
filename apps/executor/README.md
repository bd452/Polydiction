# @polydiction/executor

Automated trade execution service.

**Status**: Not implemented (planned for v3)

## Purpose

This isolated service handles:

- Risk framework and position limits
- Order construction and execution
- API key management and signing
- Position tracking and P&L

## Why Isolated?

Trade execution requires:

- Secure handling of API keys and signing credentials
- Strict risk controls and kill switches
- Audit logging for all trading activity
- Separation from detection logic for security
