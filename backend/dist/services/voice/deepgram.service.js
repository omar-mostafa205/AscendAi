"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepgramService = void 0;
const deepgram_1 = require("../../config/deepgram");
const logger_1 = __importDefault(require("../../config/logger"));
exports.deepgramService = {
    transcribeAudio: async (audioBuffer, contentType) => {
        try {
            const uploadable = contentType
                ? { data: audioBuffer, contentType }
                : audioBuffer;
            const result = await deepgram_1.deepgram.listen.v1.media.transcribeFile(uploadable, {
                model: "nova-2",
                smart_format: true,
                language: "en",
                punctuate: true,
            });
            // Deepgram SDK v5 can return either:
            // - { results: ... }
            // - { result: { results: ... }, ... } (wrapped)
            const payload = result?.results
                ? result
                : (result?.result ?? result?.response ?? result);
            const transcript = payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript ??
                payload?.channels?.[0]?.alternatives?.[0]?.transcript ??
                "";
            if (!transcript) {
                logger_1.default.warn("Deepgram STT empty transcript (debug)", {
                    contentType,
                    audioBytes: audioBuffer?.length,
                    topKeys: result && typeof result === "object" ? Object.keys(result).slice(0, 30) : [],
                    hasWrappedResult: Boolean(result?.result),
                    wrappedKeys: result?.result && typeof result.result === "object"
                        ? Object.keys(result.result).slice(0, 30)
                        : [],
                    hasResults: Boolean(payload?.results),
                });
            }
            logger_1.default.info("Deepgram STT complete", {
                contentType,
                audioBytes: audioBuffer?.length,
                transcriptLen: transcript.length,
                transcriptPreview: transcript.slice(0, 100),
            });
            return transcript;
        }
        catch (error) {
            logger_1.default.error("Deepgram STT error", { error });
            // Per interview UX: never throw, just return empty transcript so caller can handle.
            return "";
        }
    },
    AudioToSpeech: async (text) => {
        try {
            const response = await deepgram_1.deepgram.speak.v1.audio.generate({ text }, {
                model: "aura-2-thalia-en",
                encoding: "mp3",
                container: "mp3",
            });
            const stream = await response.stream();
            const chunks = [];
            if (!stream) {
                throw new Error("No audio stream received");
            }
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
        }
        catch (error) {
            logger_1.default.error("Error converting text to speech:", error);
            throw new Error("Failed to convert text to speech");
        }
    }
};
//# sourceMappingURL=deepgram.service.js.map