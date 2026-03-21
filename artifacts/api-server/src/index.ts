/**
 * Server entry point.
 *
 * Reads the PORT environment variable (required — Replit assigns a unique port
 * to each artifact so multiple services can coexist behind the same proxy),
 * validates it, then starts the Express app.
 *
 * Keeping this file minimal separates startup concerns from application logic,
 * making the app easier to test (import `app` directly without side effects).
 */

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
});
