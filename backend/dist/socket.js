"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const session_handler_1 = require("./socket/session.handler");
const socket_auth_1 = require("./middleware/socket.auth");
const logger_1 = __importDefault(require("./config/logger"));
let io;
const initializeSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });
    io.use(socket_auth_1.socketAuthMiddleware);
    io.on("connection", (socket) => {
        logger_1.default.info("Client connected", {
            socketId: socket.id,
            userId: socket.data.userId,
        });
        (0, session_handler_1.registerSessionHandlers)(io, socket);
        socket.on("disconnect", (reason) => {
            logger_1.default.info("Client disconnected", {
                socketId: socket.id,
                userId: socket.data.userId,
                reason,
            });
        });
    });
    return io;
};
exports.initializeSocket = initializeSocket;
//# sourceMappingURL=socket.js.map