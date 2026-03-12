import { Request, Response, NextFunction } from "express"
import logger from "../config/logger"

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  })
  next()
}
