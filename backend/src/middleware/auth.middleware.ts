import logger from "../config/logger";
import { supabaseAdmin } from "../config/supabase";
import { NextFunction, Response  , Request} from "express";
import * as Sentry from "@sentry/node"
import { ensureUserProfile } from "../services/user/ensure-profile"

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = req.headers["authorization"]?.split(" ")[1]
  
    if (!token) {
      logger.warn("Auth middleware: missing token", {
        path: req.path,
        method: req.method,
      })
      res.status(401).json({ error: "Unauthorized" })
      return
    }
  
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token)
  
      if (error || !data?.user) {
        logger.warn("Auth middleware: invalid token", {
          path: req.path,
          method: req.method,
          error: error?.message,
        })
        res.status(401).json({ error: "Unauthorized" })
        return
      }
  
      req.user = data.user
      await ensureUserProfile({
        id: data.user.id,
        email: data.user.email ?? "",
        name: (data.user.user_metadata as any)?.name ?? null,
        avatarUrl: (data.user.user_metadata as any)?.avatar_url ?? null,
      })
      next()
    } catch (error) {
      Sentry.captureException(error, {
        extra: {
          path: req.path,
          method: req.method,
        },
      })
      logger.error("Auth middleware: unexpected error", {
        error,
        path: req.path,
        method: req.method,
      })
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
