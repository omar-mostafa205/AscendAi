export declare const deepgramService: {
    transcribeAudio: (audioBuffer: Buffer, contentType?: string) => Promise<any>;
    AudioToSpeech: (text: string) => Promise<Buffer>;
};
