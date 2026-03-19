"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_middleware_1 = require("../../middleware/auth.middleware");
const express_1 = require("express");
const session_controller_1 = require("./session.controller");
const sessionRouter = (0, express_1.Router)({ mergeParams: true });
sessionRouter.use(auth_middleware_1.authMiddleware);
sessionRouter.post("/", session_controller_1.createSession);
sessionRouter.get("/", session_controller_1.getSessions);
exports.default = sessionRouter;
//# sourceMappingURL=session.routes.js.map