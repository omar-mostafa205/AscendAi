import { Request, Response } from "express";
export declare const getSessions: (req: Request, res: Response) => Promise<void>;
export declare const createSession: (req: Request, res: Response) => Promise<void>;
export declare const getSession: (req: Request, res: Response) => Promise<void>;
export declare const endSession: (req: Request, res: Response) => Promise<void>;
export declare const getLiveToken: (req: Request, res: Response) => Promise<void>;
