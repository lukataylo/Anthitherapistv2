/**
 * Application-wide structured logger built on Pino.
 *
 * ## Why Pino?
 * Pino is the fastest Node.js logging library and outputs newline-delimited
 * JSON in production — ideal for log aggregation services (Datadog, Loki, etc.).
 * In development it uses pino-pretty to print human-readable colourised output.
 *
 * ## Log level
 * Controlled by the LOG_LEVEL environment variable so it can be adjusted in
 * production without a code change. Defaults to "info" which captures all
 * request/response cycles and application events without flooding the console
 * with debug internals.
 *
 * ## Redaction
 * The `redact` list strips sensitive headers before they reach any log sink.
 * Authorization headers contain API keys or bearer tokens; Cookie and
 * Set-Cookie headers carry session data. Redacting them prevents credential
 * leakage in log files or log aggregation dashboards.
 *
 * This logger instance is shared with pino-http in app.ts so that per-request
 * child loggers (`req.log`) inherit the same configuration.
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  // In development, pretty-print logs with colour. In production, emit raw
  // JSON lines so log aggregation tools can parse them without a transport.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
