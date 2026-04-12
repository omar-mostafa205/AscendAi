import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import logger from "./logger";
import { env } from "./env";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDb(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Failed to connect to database", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function disconnectDb(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Database disconnected");
  } catch (error) {
    logger.error("Error disconnecting from database", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
