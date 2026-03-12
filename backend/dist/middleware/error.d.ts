import { Request, Response, NextFunction } from "express";
export declare const notFoundHandler: (req: Request, res: Response) => void;
export declare const errorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
