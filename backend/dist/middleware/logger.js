"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = __importDefault(require("../config/logger"));
const requestLogger = (req, res, next) => {
    logger_1.default.info("Incoming request", {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=logger.js.map