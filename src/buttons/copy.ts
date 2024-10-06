import { Request, Response } from "express";
import { InteractionResponseType } from "discord-interactions";

const customId = "copy";

async function execute(req: Request, res: Response) {
    const { custom_id } = req.body.data;

    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: custom_id.replace("copy:", ""),
            flags: 64
        }
    });
}

export {
    customId,
    execute
};