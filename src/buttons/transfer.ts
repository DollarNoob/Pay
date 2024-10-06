import "dotenv/config";
import { Request, Response } from "express";
import { InteractionResponseType } from "discord-interactions";
import Matic from "../cryptos/matic";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../schemas/users";
import { crypto } from "../schemas/crypto";
import { currencies, DiscordRequest } from "../utils";

const customId = "transfer";

async function execute(req: Request, res: Response) {
    // TODO: Check if button was clicked by the user
    const { custom_id } = req.body.data;

    let [ _, amount, address ] = custom_id.split(":");
    amount = parseFloat(amount);

    const db = drizzle(
        connection,
        { schema: { ...users, ...crypto }, mode: "default" }
    );

    const discordUser = req.body.user ?? req.body.member.user;
    const user = await db.select().from(users).where(eq(users.discord_id, discordUser.id));
    if (user.length === 0) {
        return res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                embeds: [
                    {
                        title: "❌ Internal Server Error",
                        description: "You are not in the database.\n-# Who are you?",
                        color: 0xEE3333
                    }
                ],
                components: []
            }
        });
    }

    const selectWallet = await db.select().from(crypto).where(eq(crypto.user_id, user[0].id));
    if (selectWallet.length === 0) {
        return res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                embeds: [
                    {
                        title: "❌ Internal Server Error",
                        description: "You are not in the database.\n-# Who are you?",
                        color: 0xEE3333
                    }
                ],
                components: []
            }
        });
    }

    const wallet = new Matic(selectWallet[0].private_key);

    const balance = await wallet.getUSDTBalance();
    if (parseFloat(balance) < amount) {
        const oAuthURL = `https://discord.com/oauth2/authorize?client_id=${process.env.APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI!)}&integration_type=1&scope=email+identify+guilds.join+applications.commands`;
        return res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                embeds: [
                    {
                        title: "💵 Send " + currencies.USDTPOL.name,
                        description: [
                            `You are ${currencies.USDTPOL.emoji} ${amount - parseFloat(balance)} short!`,
                            `${currencies.USDTPOL.emoji} ${balance} / ${currencies.USDTPOL.emoji} ${amount}`,
                            "",
                            `Please [top up](${oAuthURL}) more balance and retry.`
                        ].join("\n"),
                        color: 0xEE3333
                    }
                ],
                components: []
            }
        });
    }

    res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
            embeds: [
                {
                    title: "📡 Broadcasting your transaction...",
                    description: "Please allow us a few seconds!",
                    color: 0x5865F2
                }
            ],
            components: []
        }
    });

    const receipt = await wallet.sendUSDTToken(address, amount);
    console.log(receipt);
    // TODO: Check if transaction was successful

    await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: "PATCH",
        body: JSON.stringify({
            embeds: [
                {
                    title: "✅ Sent " + currencies.USDTPOL.name,
                    description: `${currencies.USDTPOL.emoji} ${amount} -> \`${address}\``,
                    color: 0x33BB33,
                    footer: {
                        text: "TXID: " + receipt.transactionHash
                    }
                }
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 1,
                            label: "Copy Transaction ID",
                            custom_id: "copy:" + receipt.transactionHash
                        },
                        {
                            type: 2,
                            style: 5,
                            label: "View Transaction",
                            url: "https://polygonscan.com/tx/" + receipt.transactionHash
                        }
                    ]
                }
            ]
        })
    });
}

export {
    customId,
    execute
};