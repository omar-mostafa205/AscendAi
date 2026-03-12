"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LivekitService = void 0;
const env_1 = require("../../config/env");
const livekit_1 = require("../../config/livekit");
const logger_1 = __importDefault(require("../../config/logger"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
exports.LivekitService = {
    createRoom: async (sessionId) => {
        await livekit_1.livekit.createRoom({
            name: sessionId,
            emptyTimeout: 300,
            maxParticipants: 2,
        });
        logger_1.default.info(`Livekit room created for session ${sessionId}`);
    },
    generateToken: async (sessionId, userId) => {
        const token = new livekit_server_sdk_1.AccessToken(env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET, {
            identity: userId,
            ttl: 3600,
            name: userId,
        });
        token.addGrant({
            roomJoin: true,
            room: sessionId,
            canPublish: true,
            canSubscribe: true,
        });
        return await token.toJwt();
    },
    leaveRoom: async (sessionId) => {
        await livekit_1.livekit.deleteRoom(sessionId);
        logger_1.default.info(`Livekit room deleted for session ${sessionId}`);
    }
};
//# sourceMappingURL=livekit.service.js.map