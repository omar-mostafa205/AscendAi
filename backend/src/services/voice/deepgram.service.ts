import { deepgram } from "../../config/deepgram";
import logger from "../../config/logger";

export const deepgramService = {
    transcribeAudio : async(audioBuffer : Buffer, contentType?: string) => {
        
        try {
            const uploadable = contentType
              ? ({ data: audioBuffer, contentType } as any)
              : audioBuffer

            const result = await deepgram.listen.v1.media.transcribeFile(
              uploadable,
              {
                model: "nova-2",
                smart_format: true,
                language: "en",
                punctuate: true,
              } as any
            )

            // Deepgram SDK v5 can return either:
            // - { results: ... }
            // - { result: { results: ... }, ... } (wrapped)
            const payload: any = (result as any)?.results
              ? (result as any)
              : ((result as any)?.result ?? (result as any)?.response ?? (result as any))

            const transcript =
              payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript ??
              payload?.channels?.[0]?.alternatives?.[0]?.transcript ??
              ""

            if (!transcript) {
              logger.warn("Deepgram STT empty transcript (debug)", {
                contentType,
                audioBytes: audioBuffer?.length,
                topKeys: result && typeof result === "object" ? Object.keys(result as any).slice(0, 30) : [],
                hasWrappedResult: Boolean((result as any)?.result),
                wrappedKeys:
                  (result as any)?.result && typeof (result as any).result === "object"
                    ? Object.keys((result as any).result).slice(0, 30)
                    : [],
                hasResults: Boolean((payload as any)?.results),
              })
            }

            logger.info("Deepgram STT complete", {
              contentType,
              audioBytes: audioBuffer?.length,
              transcriptLen: transcript.length,
              transcriptPreview: transcript.slice(0, 100),
            })
            return transcript
          
          } catch (error) {
            logger.error("Deepgram STT error", { error })
            // Per interview UX: never throw, just return empty transcript so caller can handle.
            return ""
          }
    },

    AudioToSpeech: async (text: string): Promise<Buffer> => {
        try {
            const response = await deepgram.speak.v1.audio.generate(
                { text },
                {
                  model: "aura-2-thalia-en",
                  encoding: "mp3",
                  container: "mp3",
                } as any
              );
              
              const stream = await response.stream();
              
              const chunks: Buffer[] = [];
              if (!stream) {
                throw new Error("No audio stream received");
              }
              for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
              }
              
              return Buffer.concat(chunks);
        } catch (error) {
          logger.error("Error converting text to speech:", error);
          throw new Error("Failed to convert text to speech");
        }
      }
     
}
