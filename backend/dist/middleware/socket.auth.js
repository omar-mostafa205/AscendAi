"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = void 0;
const supabase_1 = require("../config/supabase");
const node_1 = require("@sentry/node");
const socketAuthMiddleware = async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        node_1.logger.warn("Socket auth middleware: missing token", {
            path: socket.handshake.url,
            address: socket.handshake.address,
        });
        next(new Error("Authentication error"));
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
            node_1.logger.warn("Socket auth middleware: invalid token", {
                path: socket.handshake.url,
                address: socket.handshake.address,
                error: error?.message,
            });
            next(new Error("Authentication error"));
            return;
        }
        socket.data.userId = data.user.id;
        socket.data.email = data.user.email;
        next();
    }
    catch (error) {
        node_1.logger.error("Socket auth error", { error, socketId: socket.id });
        next(new Error("Internal Server Error"));
    }
};
exports.socketAuthMiddleware = socketAuthMiddleware;
//# sourceMappingURL=socket.auth.js.map