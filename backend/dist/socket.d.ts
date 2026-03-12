import { Server } from "socket.io";
import { Server as HttpServer } from "http";
export declare const initializeSocket: (httpServer: HttpServer) => Server;
