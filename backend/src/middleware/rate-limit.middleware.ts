import rateLimit from "express-rate-limit"

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req): string =>
    (req.headers["x-forwarded-for"] as string) ??
    req.ip ??
    req.socket.remoteAddress ??
    "unknown",

  message: {
    status: 429,
    error: "Too many requests, please try again after 15 minutes.",
  },

  handler: (req, res, _next, options) => {
    console.warn(`[RateLimit] IP ${req.ip} exceeded limit`)
    res.status(429).json(options.message)
  },
})