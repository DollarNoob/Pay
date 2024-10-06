import { Request, Response } from "express";

export default interface Command {
    data: CommandData;
    execute: (req: Request, res: Response) => Promise<void>;
}

// TODO: Finish CommandData keys
export interface CommandData {
    name: string;
    type: number;
    description: string;
    integration_types: number[];
    contexts: number[];
}