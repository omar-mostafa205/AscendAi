import { Router } from "express"
import { authMiddleware } from "../../middleware/auth.middleware"
import { endSessionById, getSessionById } from "./session.controller"

const sessionByIdRouter = Router()

sessionByIdRouter.use(authMiddleware)
sessionByIdRouter.get("/:sessionId", getSessionById)
sessionByIdRouter.post("/:sessionId/end", endSessionById)

export default sessionByIdRouter
