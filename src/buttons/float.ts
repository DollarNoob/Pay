import "dotenv/config";
import { Request, Response } from "express";
import { InteractionResponseType } from "discord-interactions";
import { currencies, DiscordRequest, removeLastZeros, sleep } from "../utils";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../schemas/users";
import { crypto } from "../schemas/crypto";
import FixedFloat from "../fixedfloat";
import Matic from "../cryptos/matic";
import { ExchangeRate, Order } from "../types/FixedFloat";

const customId = "float";

async function execute(req: Request, res: Response) {
    // TODO: Check if button was clicked by the user
    const { custom_id } = req.body.data;

    let [ _, originalAmount, originalCurrency, finalAmount, as, to ] = custom_id.split(":");
    originalAmount = parseFloat(originalAmount);
    finalAmount = parseFloat(finalAmount);
    const currency = currencies[as as keyof typeof currencies];

    res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
            embeds: [
                {
                    title: "📡 Initiating a conversion order...",
                    description: "Please allow us a few seconds!",
                    color: 0x5865F2
                }
            ],
            components: []
        }
    });

    const ff = new FixedFloat(process.env.FIXEDFLOAT_API_KEY!, process.env.FIXEDFLOAT_API_SECRET!);

    const rates: ExchangeRate | Error = await ff.exchangeRate("float", "USDTMATIC", as, "to", finalAmount).catch(err => err);
    if (rates instanceof Error) {
        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "❌ Failed to send " + currency.name,
                        description: rates.message,
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    if (rates.errors.length !== 0) {
        const descriptions = {
            MAINTENANCE_FROM: currencies.USDTPOL.name + " is under maintenance!\nPlease try again later.",
            MAINTENANCE_TO: currency.name + " is under maintenance!\nPlease choose another currency.",
            OFFLINE_FROM: currencies.USDTPOL.name + " is currently unavailable!\nPlease try again later.",
            OFFLINE_TO: currency.name + " is currently unavailable!\nPlease choose another currency.",
            RESERVE_FROM: `Not enough ${currencies.USDTPOL.name} is reserved!\nPlease send below ${currencies.USDTPOL.emoji} ${rates.from.max}.`,
            RESERVE_TO: `Not enough ${currency.name} is reserved!\nPlease send below ${currency.emoji} ${rates.to.max}.`,
            LIMIT_MIN: `You must send atleast ${currencies.USDTPOL.emoji} ${rates.from.min}.`,
            LIMIT_MAX: `You must send less than ${currencies.USDTPOL.emoji} ${rates.from.max}.`
        };

        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "❌ Failed to send " + currency.name,
                        description: rates.errors.map(err => descriptions[err]).join("\n\n"),
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    const db = drizzle(
        connection,
        { schema: { ...users, ...crypto }, mode: "default" }
    );

    const discordUser = req.body.user ?? req.body.member.user;
    const user = await db.select().from(users).where(eq(users.discord_id, discordUser.id));
    if (user.length === 0) {
        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "❌ Internal Server Error",
                        description: "You are not in the database.\n-# Who are you?",
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    const selectWallet = await db.select().from(crypto).where(eq(crypto.user_id, user[0].id));
    if (selectWallet.length === 0) {
        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "❌ Internal Server Error",
                        description: "You are not in the database.\n-# Who are you?",
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    const wallet = new Matic(selectWallet[0].private_key);

    const balance = await wallet.getUSDTBalance();
    if (parseFloat(balance) < parseFloat(rates.from.amount)) {
        const oAuthURL = `https://discord.com/oauth2/authorize?client_id=${process.env.APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI!)}&integration_type=1&scope=email+identify+guilds.join+applications.commands`;
        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "💵 Send " + currency.name,
                        description: [
                            `You are ${currencies.USDTPOL.emoji} ${parseFloat(rates.from.amount) - parseFloat(balance)} short!`,
                            `${currencies.USDTPOL.emoji} ${balance} / ${currencies.USDTPOL.emoji} ${rates.from.amount}`,
                            "",
                            `Please [top up](${oAuthURL}) more balance and retry.`
                        ].join("\n"),
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    const order: Order | Error = await ff.createOrder("float", "USDTMATIC", as, "to", finalAmount, to).catch(err => err);
    // TODO: Save order in DB
    if (order instanceof Error) { // Error
        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "❌ Failed to send " + currency.name,
                        description: order.message,
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    // Recheck
    if (parseFloat(balance) < parseFloat(order.from.amount)) {
        const oAuthURL = `https://discord.com/oauth2/authorize?client_id=${process.env.APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI!)}&integration_type=1&scope=email+identify+guilds.join+applications.commands`;
        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: "💵 Send " + currency.name,
                        description: [
                            `You are ${currencies.USDTPOL.emoji} ${parseFloat(rates.from.amount) - parseFloat(balance)} short!`,
                            `${currencies.USDTPOL.emoji} ${balance} / ${currencies.USDTPOL.emoji} ${rates.from.amount}`,
                            "",
                            `Please [top up](${oAuthURL}) more balance and retry.`
                        ].join("\n"),
                        color: 0xEE3333
                    }
                ],
                components: []
            })
        });
        return;
    }

    await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: "PATCH",
        body: JSON.stringify({
            embeds: [
                {
                    title: "📡 Broadcasting your transaction...",
                    description: "Please allow us a few seconds!",
                    color: 0x5865F2
                }
            ],
            components: []
        })
    });

    const receipt = await wallet.sendUSDTToken(order.from.address, order.from.amount);
    console.log(receipt);
    // TODO: Check if transaction was successful

    await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
        method: "PATCH",
        body: JSON.stringify({
            embeds: [
                {
                    title: `📦 Requesting ${currency.name}...`,
                    description: [
                        `\`${to}\``,
                        "",
                        `${currencies.USDTPOL.emoji} ${removeLastZeros(order.from.amount)} -> ${currency.emoji} ${removeLastZeros(order.to.amount)} (0.5% fees)`,
                        "",
                        "-# This is an estimate, the final amount may vary."
                    ].join("\n"),
                    color: 0x5865F2
                }
            ],
            components: []
        })
    });

    // TODO: Implement refresh & encrypt order id and order status or just get it from db :shrug:
    let i = 0;
    let newOrder: Order | null = null;
    while (i < 300) { // Repeat every 10 seconds 30 times (for 5~ minutes)
        const _newOrder = await ff.getOrder(order.id, order.token).catch(err => err);
        if (_newOrder instanceof Error) {
            console.log(_newOrder);
            await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
                method: "PATCH",
                body: JSON.stringify({
                    embeds: [
                        {
                            title: `📦 Requesting ${currency.name}...`,
                            description: [
                                `\`${to}\``,
                                "",
                                `${currencies.USDTPOL.emoji} ${removeLastZeros((newOrder ?? order).from.amount)} -> ${currency.emoji} ${removeLastZeros((newOrder ?? order).to.amount)} (0.5% fees)`,
                                "",
                                "-# An internal server error has occurred.",
                                "-# Please click refresh to auto-refresh."
                            ].join("\n"),
                            color: 0xEE3333
                        }
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 1,
                                    label: "Refresh",
                                    custom_id: `refresh:${order.id}:${order.token}`
                                }
                            ]
                        }
                    ]
                })
            });
            return;
        }

        newOrder = _newOrder;
        if (!newOrder) return; // TypeScript related issues; just ignore

        // TODO: Remove this console log
        if (newOrder.status === "EXCHANGE" || newOrder.status === "WITHDRAW") console.log(JSON.stringify(_newOrder));
        const description = [
            `\`${to}\``,
            "",
            `${currencies.USDTPOL.emoji} ${removeLastZeros(newOrder.from.amount)} -> ${currency.emoji} ${removeLastZeros(newOrder.to.amount)} (0.5% fees)`,
        ];

        if (newOrder.status === "NEW") {
            description.push("\n-# This is an estimate, the final amount may vary.");
        } else if (newOrder.status === "PENDING") {
            description.push(`\n-# Waiting ${newOrder.from.tx.confirmations} / ${newOrder.from.reqConfirmations} confirmations.\n-# This step usually does not take more than a minute.`);
        }

        const titles = {
            NEW: `📦 Requesting ${currency.name}...`,
            PENDING: `⏳ Pending confirmations...`,
            EXCHANGE: `📦 Exchanging ${currency.name}...`,
            WITHDRAW: `📨 Sending ${currency.name}...`,
            DONE: "✅ Sent " + currency.name,
            EXPIRED: "🪫 Order expired", // This should not happen though
            EMERGENCY: "⏰ Emergency: View your order and place a refund"
        };
        const colors = {
            NEW: 0x5865F2,
            PENDING: 0x5865F2,
            EXCHANGE: 0x5865F2,
            WITHDRAW: 0x5865F2,
            DONE: 0x33BB33,
            EXPIRED: 0x333333, // This should not happen though
            EMERGENCY: 0xEE3333
        };
        const components = [{
            type: 1,
            components: []
        }];

        if (newOrder.status === "PENDING") {
            (components[0].components as Array<any>).push({
                type: 2,
                style: 5,
                label: "View Transaction",
                url: "https://polygonscan.com/tx/" + receipt.transactionHash
            });
        } else if (newOrder.status === "DONE") {
            // TODO: different block explorers for different currencies
            (components[0].components as Array<any>).push({
                type: 2,
                style: 1,
                label: "Copy Transaction ID",
                custom_id: "copy:" + newOrder.to.tx.id
            });
            (components[0].components as Array<any>).push({
                type: 2,
                style: 5,
                label: "View Transaction",
                url: "https://polygonscan.com/tx/" + newOrder.to.tx.id
            });
        } else if (newOrder.status === "EXPIRED" || newOrder.status === "EMERGENCY") {
            (components[0].components as Array<any>).push({
                type: 2,
                style: 5,
                label: "View Order",
                url: "https://ff.io/order/" + newOrder.id
            });
        }

        await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
            method: "PATCH",
            body: JSON.stringify({
                embeds: [
                    {
                        title: titles[newOrder.status],
                        description: description.join("\n"),
                        color: colors[newOrder.status]
                    }
                ],
                components
            })
        });

        if (newOrder.status === "DONE") break;

        await sleep(1000);
    }
}

export {
    customId,
    execute
};