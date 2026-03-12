"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const job_controller_1 = require("./job.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const jobRouter = (0, express_1.Router)();
jobRouter.use(auth_middleware_1.authMiddleware);
jobRouter.get("/", job_controller_1.getJobs);
jobRouter.post("/", job_controller_1.createJob);
jobRouter.get("/:id", job_controller_1.getJobById);
exports.default = jobRouter;
//# sourceMappingURL=job.routes.js.map