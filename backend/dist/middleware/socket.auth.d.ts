import { Socket } from "socket.io";
export declare const socketAuthMiddleware: (socket: Socket, next: (err?: Error) => void) => Promise<void>;
