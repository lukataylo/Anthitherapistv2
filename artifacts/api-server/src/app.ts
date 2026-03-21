/**
 * Express application factory.
 *
 * Configures global middleware in order:
 *
 *  1. pino-http — structured request/response logging. Sensitive headers
 *     (Authorization, Cookie, Set-Cookie) are redacted by the underlying
 *     Pino logger. The serializers strip query strings from URLs so they
 *     don't accidentally log user-submitted thoughts.
 *
 *  2. cors — allows the Expo mobile app (served from a different origin in
 *     development) to reach the API. In production the app and API share the
 *     same Replit domain, but keeping CORS open avoids issues during local dev.
 *
 *  3. express.json / urlencoded — parse incoming request bodies. The reframe
 *     route expects `{ thought: string }` as JSON.
 *
 *  4. /api router — all application routes are prefixed with /api so they are
 *     cleanly separated from any future static-file serving.
 *
 * The app object is exported separately from the server startup (index.ts) so
 * it can be imported in tests without binding a real port.
 */

import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import landingRouter from "./routes/landing";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Strip query strings — they could contain user-typed content
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — restrict to known origins in production, allow all in development
const allowedOrigins = process.env["ALLOWED_ORIGINS"]?.split(",") ?? [];
app.use(
  cors(
    allowedOrigins.length > 0
      ? { origin: allowedOrigins }
      : undefined,
  ),
);

// Body size limits to prevent memory exhaustion
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limit the AI-powered reframe endpoint to control costs
const reframeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly" },
});
app.use("/api/reframe", reframeLimiter);

app.use("/api", router);

app.use("/", landingRouter);

export default app;
