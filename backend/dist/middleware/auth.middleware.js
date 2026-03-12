"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const logger_1 = __importDefault(require("../config/logger"));
const supabase_1 = require("../config/supabase");
const Sentry = __importStar(require("@sentry/node"));
const ensure_profile_1 = require("../services/user/ensure-profile");
const authMiddleware = async (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
        logger_1.default.warn("Auth middleware: missing token", {
            path: req.path,
            method: req.method,
        });
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
            logger_1.default.warn("Auth middleware: invalid token", {
                path: req.path,
                method: req.method,
                error: error?.message,
            });
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        req.user = data.user;
        await (0, ensure_profile_1.ensureUserProfile)({
            id: data.user.id,
            email: data.user.email ?? "",
            name: data.user.user_metadata?.name ?? null,
            avatarUrl: data.user.user_metadata?.avatar_url ?? null,
        });
        next();
    }
    catch (error) {
        Sentry.captureException(error, {
            extra: {
                path: req.path,
                method: req.method,
            },
        });
        logger_1.default.error("Auth middleware: unexpected error", {
            error,
            path: req.path,
            method: req.method,
        });
        res.status(500).json({ error: "Internal Server Error" });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map