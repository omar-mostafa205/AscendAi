import {RoomServiceClient} from 'livekit-server-sdk';
import {env} from './env';

export const livekit = new RoomServiceClient(env.LIVEKIT_URL,env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
 