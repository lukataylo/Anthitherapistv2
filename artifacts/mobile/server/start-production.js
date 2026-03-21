/**
 * Production process orchestrator.
 *
 * Starts two processes:
 *   1. API server — locked to an internal port (9090) so it never collides
 *      with the PORT Replit assigns to the public-facing web server.
 *   2. serve.js   — reads PORT from the environment (set by Replit's autoscale
 *      runtime) and proxies /api/* to the API server on the internal port.
 *
 * Why not bash -c "cmd1 & cmd2"?
 *   bash exits immediately after forking both processes, which confuses
 *   Replit's health-check because there is no long-running foreground process.
 *   This script stays alive as the parent and forwards exit signals to both
 *   children, ensuring a clean shutdown.
 */

"use strict";

const { spawn } = require("child_process");
const path = require("path");

const INTERNAL_API_PORT = "9090";

const root = path.resolve(__dirname, "../../..");

function startProcess(cmd, args, env, label) {
  const child = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: "inherit",
    cwd: root,
  });

  child.on("error", (err) => {
    console.error(`[${label}] failed to start:`, err.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with code ${code}`);
      process.exit(code);
    }
    if (signal) {
      console.log(`[${label}] killed by signal ${signal}`);
    }
  });

  return child;
}

// 1. Start API server on the fixed internal port
const apiServer = startProcess(
  "node",
  [path.resolve(root, "artifacts/api-server/dist/index.cjs")],
  { PORT: INTERNAL_API_PORT },
  "api-server"
);

// 2. Start the static web server — reads PORT from Replit's env,
//    proxies /api/* to the API server on INTERNAL_API_PORT
const webServer = startProcess(
  "node",
  [path.resolve(__dirname, "serve.js")],
  { API_PORT: INTERNAL_API_PORT },
  "web-server"
);

// Forward termination signals to both children
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  apiServer.kill(signal);
  webServer.kill(signal);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(
  `[start-production] API server → :${INTERNAL_API_PORT} | Web server → :${process.env.PORT || 3000}`
);
