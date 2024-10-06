import "dotenv/config";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { VerifyDiscordRequest, InstallGlobalCommands } from "./utils";
import connect from "./schemas/index";
import Command from "./types/Command";
import { InteractionType, InteractionResponseType } from "discord-interactions";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import Button from "./types/Button";

const app = express();
const PORT = process.env.PORT || 80;

const commands: Command[] = [];
const buttons: Button[] = [];

app.use(express.json({
    verify: VerifyDiscordRequest(process.env.PUBLIC_KEY!)
}));

app.get("/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
        res.status(401).send("Token required");
        return;
    }

    const tokenRequest = await fetch(process.env.API_ENDPOINT + "/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
            "client_id": process.env.APP_ID!,
            "client_secret": process.env.CLIENT_SECRET!,
            "grant_type": "authorization_code",
            "code": code as string,
            "redirect_uri": process.env.REDIRECT_URI!
        })
    }).catch(console.error);

    if (!tokenRequest) {
        res.status(500).send("Failed to get oauth2 token");
        return;
    } else if (tokenRequest.status !== 200) {
        res.status(500).send(`Discord returned error ${tokenRequest.status}: ${tokenRequest.statusText}`);
        return;
    }

    const token: {
        token_type: "Bearer";
        access_token: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
    } = await tokenRequest.json();

    console.log(token);

    // scope 체크
    const scopes = token.scope.split(" ").sort();
    const requiredScopes = [ "applications.commands", "email", "guilds.join", "identify" ];
    if (!scopes.every((scope, i) => scope === requiredScopes[i])) {
        res.status(500).send("Required scopes not fulfilled");
        return;
    }

    const infoRequest = await fetch(process.env.API_ENDPOINT + "/users/@me", {
        headers: {
            Authorization: "Bearer " + token.access_token
        }
    }).catch(console.error);

    if (!infoRequest) {
        res.status(500).send("Failed to get user info");
        return;
    } else if (infoRequest.status !== 200) {
        res.status(500).send(`Discord returned error ${infoRequest.status}: ${infoRequest.statusText}`);
        return;
    }

    const info: {
        id: string;
        username: string;
        avatar: string | null;
        discriminator: string;
        public_flags: number;
        flags: number;
        banner: string | null; // not sure
        accent_color: string | null; // not sure
        global_name: string; // null?
        avatar_decoration_data: string | null; // not sure
        banner_color: string | null; // not sure
        clan: string | null; // not sure
        mfa_enabled: boolean;
        locale: string;
        premium_type: number | null; // not sure
        email: string | null; // not sure
        verified: boolean;
    } = await infoRequest.json();

    // 이메일 인증 체크
    if (!info.verified || info.email === null) {
        res.status(403).send("디스코드 계정의 이메일 인증을 완료해주세요");
        return;
    }

    /*
        info.id: discord_id
        info.email: email
        info.locale: locale (단순 사용 언어 수집용)
        DB에 저장
    */
    // TODO: Save info in db
    console.log(info);

    res.redirect("https://discord.com/oauth2/authorized");
    return;
});

app.post("/interactions", async (req, res) => {
    const { type, data } = req.body;

    // console.log(req.body);
    if (type === InteractionType.PING) {
        res.send({ type: InteractionResponseType.PONG });
        return;
    } else if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        const command = commands.find(cmd => cmd.data.name === name);
        if (!command) {
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Unknown Command",
                    flags: 64
                }
            });
            return;
        }

        return command.execute(req, res);
    } else if (type === InteractionType.MESSAGE_COMPONENT) {
        const { custom_id } = data;

        const button = buttons.find(btn => btn.customId === custom_id.split(":")[0]);
        if (!button) {
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Unknown Interaction",
                    flags: 64
                }
            });
            return;
        }

        return button.execute(req, res);
    } else if (type === InteractionType.MODAL_SUBMIT) {
        // modal submit
    }
});

app.listen(PORT, async () => {
    console.log("[Express] Listening on port", PORT);

    await connect();

    const commandsPath = path.resolve(__dirname, "commands");
    const commandNames = await fs.readdir(commandsPath);

    for (const commandName of commandNames) {
        const command = await import(path.resolve(commandsPath, commandName));
        commands.push(command);
    }

    await InstallGlobalCommands(
        process.env.APP_ID!,
        commands.map(command => command.data)
    );

    const buttonsPath = path.resolve(__dirname, "buttons");
    const buttonNames = await fs.readdir(buttonsPath);

    for (const buttonName of buttonNames) {
        const button = await import(path.resolve(buttonsPath, buttonName));
        buttons.push(button);
    }
});