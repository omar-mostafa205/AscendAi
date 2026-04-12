import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};
const { combine, timestamp, printf, json, colorize, errors } = winston.format;
const consoleFormat = printf(
  ({ level, message, timestamp, stack, ...metadata }) => {
    let output = `${timestamp} [${level}] : ${message}`;
    if (stack) {
      output += `\n${stack}`;
    }
    if (Object.keys(metadata).length > 0) {
      output += `\n${JSON.stringify(metadata, null, 2)}`;
    }

    return output;
  },
);

const isProduction = process.env.NODE_ENV === "production";
const logger = winston.createLogger({
  level: "debug",
  levels: levels,
  defaultMeta: {
    service: "AscendAI",
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        errors({ stack: true }),
        consoleFormat,
      ),
    }),
    ...(isProduction
      ? [
          new DailyRotateFile({
            filename: "application-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d",
          }),
        ]
      : []),
  ],
  exitOnError: false,
});
export default logger;
