import { NextFunction, Response, Request } from "express";
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
