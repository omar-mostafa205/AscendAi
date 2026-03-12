"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepgram = void 0;
const env_1 = require("./env");
const sdk_1 = require("@deepgram/sdk");
exports.deepgram = new sdk_1.DeepgramClient({ apiKey: env_1.env.DEEPGRAM_API_KEY });
//# sourceMappingURL=deepgram.js.map