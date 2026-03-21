/**
 * Route aggregator.
 *
 * Mounts all sub-routers onto a single Express Router so that `app.ts` only
 * needs one `app.use("/api", router)` call. Adding a new feature area means
 * importing its router here rather than touching the app factory.
 *
 * Current routes (all prefixed with /api by the parent):
 *   GET  /api/healthz  — liveness probe
 *   POST /api/reframe  — AI-powered cognitive distortion analysis
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reframeRouter from "./reframe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reframeRouter);

export default router;
