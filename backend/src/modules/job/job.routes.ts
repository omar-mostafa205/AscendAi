import { Router } from "express";
import { createJob, getJobById, getJobs } from "./job.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  validate,
  createJobSchema,
} from "../../middleware/validate.middleware";

const jobRouter = Router();

jobRouter.use(authMiddleware);
jobRouter.get("/", getJobs);
jobRouter.post("/", validate(createJobSchema), createJob);
jobRouter.get("/:id", getJobById);

export default jobRouter;
