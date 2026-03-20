import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reframeRouter from "./reframe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reframeRouter);

export default router;
