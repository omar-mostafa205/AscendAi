import { Router } from "express"
import { authMiddleware } from "../../middleware/auth.middleware"
import { endSession, getLiveToken, getSession } from "./session.controller"

const sessionByIdRouter = Router()

sessionByIdRouter.use(authMiddleware)
sessionByIdRouter.get("/:id", getSession)
sessionByIdRouter.post("/:id/end", endSession)
sessionByIdRouter.post("/:id/live-token", getLiveToken)

export default sessionByIdRouter

