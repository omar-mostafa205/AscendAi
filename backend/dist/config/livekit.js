"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livekit = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const env_1 = require("./env");
exports.livekit = new livekit_server_sdk_1.RoomServiceClient(env_1.env.LIVEKIT_URL, env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET);
//# sourceMappingURL=livekit.js.map