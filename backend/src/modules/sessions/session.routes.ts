import { authMiddleware } from "../../middleware/auth.middleware";
import { Router } from "express";
import { createSession, getLiveToken, getSessions } from "./session.controller";

const sessionRouter = Router({ mergeParams: true })

sessionRouter.use(authMiddleware)
sessionRouter.post("/", createSession)
sessionRouter.get("/", getSessions)


export default sessionRouter
