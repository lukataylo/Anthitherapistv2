#!/bin/bash
set -e

# Install any new packages added by task agents.
# Non-interactive, idempotent, safe to run multiple times.
pnpm install
