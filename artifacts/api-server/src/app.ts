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
import pinoHttp from "pino-http";
import router from "./routes";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
