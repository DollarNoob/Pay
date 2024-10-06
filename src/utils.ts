import { Request, Response } from "express";
import { verifyKey } from "discord-interactions";
import { CommandData } from "./types/Command";
import { version, repository } from "../package.json";

export const currencies = {
    USDTPOL: {
        name: "Tether (Polygon)",
        emoji: "<:USDT:1291323526711738429>"
    },
    POL: {
        name: "Polygon",
        emoji: "<:POL:1291322838812196886>"
    },
    TRX: {
        name: "Tronix",
        emoji: "<:TRX:1291341778070405181>"
    },
    LTC: {
        name: "Litecoin",
        emoji: "<:LTC:1291341903115190292>"
    },
    USDTSOL: {
        name: "Tether (Solana)",
        emoji: "<:USDT:1291323526711738429>"
    },
    SOL: {
        name: "Solana",
        emoji: "<:SOL:1291342011001081897>"
    }
};

export function VerifyDiscordRequest(clientKey: string) {
    return function(req: Request, res: Response, buf: Buffer) {
        const signature = req.get("X-Signature-Ed25519");
        const timestamp = req.get("X-Signature-Timestamp");

        if (!signature || !timestamp) {
            res.status(401).send("Request signature required");
            throw new Error("Request signature required");
        }

        const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
        // if (Math.floor(Math.random() * 2) === 0) { // discord's example won't work so I have to bypass the check :thinking:
        if (!isValidRequest) {
            res.status(401).send("Bad request signature");
            throw new Error("Bad request signature");
        }
    }
}

export async function DiscordRequest(endpoint: string, options: RequestInit) {
    const url = "https://discord.com/api/v10/" + endpoint;

    const res = await fetch(url, {
        headers: {
            Authorization: "Bot " + process.env.DISCORD_TOKEN,
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent": `DiscordBot (${repository.url}, ${version})`
        },
        ...options
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(JSON.stringify(data));
    }

    return res;
}

export async function InstallGlobalCommands(appId: string, commands: CommandData[]) {
    const endpoint = `applications/${appId}/commands`;

    try {
        await DiscordRequest(endpoint, {
            method: "PUT",
            body: JSON.stringify(commands)
        });

        console.log("[Discord] Registered", commands.length, "commands");
    } catch (err) {
        console.error(err);
    }
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Decode(encoded: string) {
    let n = BigInt(0);
    for (const char of encoded) {
        const index = BASE58.indexOf(char);
        if (index === -1) {
            return Buffer.from([]);
        }
        n = n * BigInt(58) + BigInt(index);
    }

    const hex = n.toString(16);
    return Buffer.from(hex, "hex");
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function removeLastZeros(text: string) {
    return text.replace(/0+$/, "");
}