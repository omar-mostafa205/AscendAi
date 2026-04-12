import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";
import * as Sentry from "@sentry/node";

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ error: `Route ${req.path} not found` });
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  Sentry.captureException(error);
  logger.error("Unhandled error", { error: error.message, path: req.path });
  res.status(500).json({ error: "Internal Server Error" });
};
