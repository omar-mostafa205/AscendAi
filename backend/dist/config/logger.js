"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};
const { combine, timestamp, printf, json, colorize, errors } = winston_1.default.format;
const consoleFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let output = `${timestamp} [${level}] : ${message}`;
    if (stack) {
        output += `\n${stack}`;
    }
    if (Object.keys(metadata).length > 0) {
        output += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    return output;
});
const isProduction = process.env.NODE_ENV === "production";
const logger = winston_1.default.createLogger({
    level: "debug",
    levels: levels,
    defaultMeta: {
        service: "AscendAI",
        environment: process.env.NODE_ENV
    },
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), timestamp({
                format: "YYYY-MM-DD HH:mm:ss"
            }), errors({ stack: true }), consoleFormat)
        }),
        ...(isProduction ? [
            new winston_daily_rotate_file_1.default({
                filename: "application-%DATE%.log",
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "14d"
            })
        ] : [])
    ],
    exitOnError: false
});
exports.default = logger;
//# sourceMappingURL=logger.js.map