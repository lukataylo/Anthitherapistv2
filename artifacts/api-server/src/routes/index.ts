/**
 * Route aggregator.
 *
 * Mounts all sub-routers onto a single Express Router so that `app.ts` only
 * needs one `app.use("/api", router)` call. Adding a new feature area means
 * importing its router here rather than touching the app factory.
 *
 * Current routes (all prefixed with /api by the parent):
 *   GET  /api/healthz                        — liveness probe
 *   POST /api/reframe                        — AI-powered cognitive distortion analysis
 *   POST /api/discuss                        — Socratic dialogue coaching (persists to DB)
 *   POST /api/reflect                        — LLM-generated narrative insight for a reframing session
 *   GET  /api/conversations                  — list past Discuss conversations
 *   GET  /api/conversations/:id/messages     — full message history for one conversation
 *   POST /api/patterns                       — AI-generated pattern observations from history
 *   POST /api/analyse-turn                   — background therapeutic analysis of a journal turn
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reframeRouter from "./reframe";
import discussRouter from "./discuss";
import reflectRouter from "./reflect";
import patternsRouter from "./patterns";
import analyseTurnRouter from "./analyse-turn";
import summariseSessionRouter from "./summarise-session";
import spiritAnimalRouter from "./spirit-animal";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reframeRouter);
router.use(discussRouter);
router.use(reflectRouter);
router.use(patternsRouter);
router.use(analyseTurnRouter);
router.use(summariseSessionRouter);
router.use(spiritAnimalRouter);
router.use(authRouter);

export default router;
