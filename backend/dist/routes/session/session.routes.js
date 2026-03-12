"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const session_controller_1 = require("./session.controller");
const sessionByIdRouter = (0, express_1.Router)();
sessionByIdRouter.use(auth_middleware_1.authMiddleware);
sessionByIdRouter.get("/:sessionId", session_controller_1.getSessionById);
sessionByIdRouter.post("/:sessionId/end", session_controller_1.endSessionById);
exports.default = sessionByIdRouter;
//# sourceMappingURL=session.routes.js.map