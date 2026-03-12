import { env } from "./env";
import { DeepgramClient } from "@deepgram/sdk";
export const deepgram = new DeepgramClient({apiKey: env.DEEPGRAM_API_KEY}); 