import { Request, Response } from "express";

export default interface Button {
    customId: string;
    execute: (req: Request, res: Response) => Promise<void>;
}