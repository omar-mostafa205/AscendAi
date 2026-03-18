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
exports.initSentry = void 0;
const Sentry = __importStar(require("@sentry/node"));
const logger_1 = __importDefault(require("../config/logger"));
const initSentry = () => {
    if (!process.env.SENTRY_DSN) {
        logger_1.default.warn('SENTRY_DSN not set, Sentry disabled');
        return;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const nodeMajor = Number(process.versions.node.split(".")[0] ?? "0");
    const profilingSupported = [16, 18, 20, 22, 24].includes(nodeMajor);
    // Avoid importing @sentry/profiling-node on unsupported Node versions to prevent warnings/crashes.
    const integrations = [Sentry.googleGenAIIntegration()];
    if (profilingSupported) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { nodeProfilingIntegration } = require("@sentry/profiling-node");
            integrations.unshift(nodeProfilingIntegration());
        }
        catch (e) {
            logger_1.default.warn("Sentry profiling integration failed to load; continuing without profiling", { error: e });
        }
    }
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: isProduction ? 0.1 : 1.0,
        profilesSampleRate: profilingSupported ? (isProduction ? 0.1 : 1.0) : 0,
        debug: process.env.NODE_ENV === 'development',
        attachStacktrace: true,
        enabled: isProduction,
        integrations,
    });
};
exports.initSentry = initSentry;
exports.default = Sentry;
//# sourceMappingURL=sentry.js.map