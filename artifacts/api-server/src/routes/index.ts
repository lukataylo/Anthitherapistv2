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
 *   POST /api/discuss  — Socratic dialogue coaching
 *   POST /api/reflect  — LLM-generated narrative insight for a reframing session
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reframeRouter from "./reframe";
import discussRouter from "./discuss";
import reflectRouter from "./reflect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reframeRouter);
router.use(discussRouter);
router.use(reflectRouter);

export default router;
