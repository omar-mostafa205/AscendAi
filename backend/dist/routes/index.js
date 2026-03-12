"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const job_routes_1 = __importDefault(require("./job/job.routes"));
const session_routes_1 = __importDefault(require("./sessions/session.routes"));
const session_routes_2 = __importDefault(require("./session/session.routes"));
const router = (0, express_1.Router)();
router.use("/jobs", job_routes_1.default);
router.use("/jobs/:jobId/sessions", session_routes_1.default);
router.use("/sessions", session_routes_2.default);
exports.default = router;
//# sourceMappingURL=index.js.map