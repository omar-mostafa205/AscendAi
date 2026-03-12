"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDb = connectDb;
exports.disconnectDb = disconnectDb;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const logger_1 = __importDefault(require("./logger"));
const env_1 = require("./env");
const globalForPrisma = global;
const connectionString = env_1.env.DATABASE_URL;
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        adapter,
        log: env_1.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
async function connectDb() {
    try {
        await exports.prisma.$connect();
        logger_1.default.info('Database connected successfully');
    }
    catch (error) {
        logger_1.default.error('Failed to connect to database', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
async function disconnectDb() {
    try {
        await exports.prisma.$disconnect();
        logger_1.default.info('Database disconnected');
    }
    catch (error) {
        logger_1.default.error('Error disconnecting from database', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
//# sourceMappingURL=database.js.map