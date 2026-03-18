"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const session_controller_1 = require("./session.controller");
const sessionByIdRouter = (0, express_1.Router)();
sessionByIdRouter.use(auth_middleware_1.authMiddleware);
sessionByIdRouter.get("/:id", session_controller_1.getSession);
sessionByIdRouter.post("/:id/end", session_controller_1.endSession);
sessionByIdRouter.post("/:id/live-token", session_controller_1.getLiveToken);
exports.default = sessionByIdRouter;
//# sourceMappingURL=sessionById.routes.js.map