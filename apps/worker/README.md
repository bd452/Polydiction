# @polydiction/worker

WebSocket ingestion worker for live market data.

**Status**: Not implemented (planned for v2)

## Purpose

This service will run outside Vercel (long-lived process) to:

- Maintain WebSocket connections to Polymarket
- Parse and normalize live events
- Push events to the database via queue/API bridge

## Why a Separate Service?

Vercel serverless functions have a maximum execution time and cannot maintain
persistent WebSocket connections. This worker will run on a platform that
supports long-running processes (e.g., Railway, Fly.io, EC2).
