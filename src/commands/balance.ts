import { Request, Response } from "express";
import { InteractionResponseType } from "discord-interactions";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users } from "../schemas/users";
import { crypto } from "../schemas/crypto";
import Matic from "../cryptos/matic";
import { currencies } from "../utils";

const data = {
    name: "balance",
    name_localizations: { "ko": "잔액" },
    type: 1,
    description: "Displays your current POL & USDT balance.",
    description_localizations: { "ko": "현재 POL & USDT 잔액을 조회합니다." },
    integration_types: [1],
    contexts: [0, 1, 2]
};

async function execute(req: Request, res: Response) {
    const db = drizzle(
        connection,
        { schema: { ...users, ...crypto }, mode: "default" }
    );

    const discordUser = req.body.user ?? req.body.member.user;
    const user = await db.select().from(users).where(eq(users.discord_id, discordUser.id));
    if (user.length === 0) {
        const insert = await db.insert(users).values({
            discord_id: discordUser.id,
            created_at: new Date()
        });
        console.log(insert);
    }

    let wallet: Matic;
    const selectWallet = await db.select().from(crypto).where(eq(crypto.user_id, user[0].id));
    if (selectWallet.length === 0) {
        const account = Matic.create();

        await db.insert(crypto).values({
            user_id: user[0].id,
            public_key: account.address,
            private_key: account.privateKey,
            created_at: new Date()
        });

        wallet = new Matic(account.privateKey);
    } else {
        wallet = new Matic(selectWallet[0].private_key);
    }

    const balance = await Promise.all([
        wallet.getBalance(),
        wallet.getUSDTBalance()
    ]);

    const polPrice = 0.44;
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            embeds: [
                {
                    title: "🪙 Your Balance",
                    description: `${currencies.POL.emoji} ${balance[0]} (~${(parseFloat(balance[0]) * polPrice).toLocaleString()} USD)
${currencies.USDTPOL.emoji} ${balance[1]}`,
                    color: 0x5865F2,
                    footer: {
                        text: wallet.address
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
                            label: "Copy Address",
                            custom_id: "copy:" + wallet.address
                        }
                    ]
                }
            ]
        }
    });
}

export {
    data,
    execute
};