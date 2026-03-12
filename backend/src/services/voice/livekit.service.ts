import { env } from "../../config/env";
import { livekit } from "../../config/livekit"
import logger from "../../config/logger"
import { AccessToken } from "livekit-server-sdk"

export const LivekitService = {
    createRoom : async (sessionId: string) => {
        await livekit.createRoom({
            name : sessionId,
            emptyTimeout : 300,
            maxParticipants : 2,   
        })
        logger.info(`Livekit room created for session ${sessionId}`)
},
    generateToken : async (sessionId: string, userId: string) => {
        const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
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
        return await (token as any).toJwt();
    },

    leaveRoom : async (sessionId: string) => {
        await livekit.deleteRoom(sessionId);
        logger.info(`Livekit room deleted for session ${sessionId}`)
    }
}
