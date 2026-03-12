export declare const LivekitService: {
    createRoom: (sessionId: string) => Promise<void>;
    generateToken: (sessionId: string, userId: string) => Promise<any>;
    leaveRoom: (sessionId: string) => Promise<void>;
};
