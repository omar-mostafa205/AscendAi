import { Router } from "express"
import jobRouter from "./job/job.routes"
import sessionRouter from "./sessions/session.routes"
import sessionByIdRouter from "./sessions/sessionById.routes"

const router = Router()

router.use("/jobs", jobRouter)
router.use("/jobs/:jobId/sessions", sessionRouter)
router.use("/sessions", sessionByIdRouter)

export default router
