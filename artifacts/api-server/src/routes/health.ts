/**
 * Health check route.
 *
 * GET /api/healthz
 *
 * Returns a simple JSON response used by deployment infrastructure and the
 * Replit proxy to confirm the server is up and accepting connections. Parsing
 * the response through the shared HealthCheckResponse Zod schema ensures the
 * contract between this server and any consumer is validated at runtime.
 */

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
