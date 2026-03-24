import { NextFunction, Request, Response } from "express"
import { z, ZodSchema } from "zod"
import sanitizeHtml from "sanitize-html"

const sanitizeString = (str: string) =>
    sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} })

export const createJobSchema = z.object({
    title: z.string().min(2).max(100).transform(sanitizeString),
    company: z.string().min(2).max(100).transform(sanitizeString),
    jobDescription: z.string().min(10).max(5000).transform(sanitizeString),
})


export const validate = (schema: z.ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = schema.parse(req.body)
        req.body = parsed
        next()
    } catch (error) {
        next(error)
    }
}