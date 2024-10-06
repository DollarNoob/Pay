import "dotenv/config";
import { Request, Response } from "express";
import { InteractionResponseType } from "discord-interactions";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { load } from "cheerio";
import { users } from "../schemas/users";
import { crypto } from "../schemas/crypto";
import Matic from "../cryptos/matic";
import Solana from "../cryptos/solana";
import Tronix from "../cryptos/tronix";
import Litecoin from "../cryptos/litecoin";
import { currencies, DiscordRequest } from "../utils";

const data = {
    name: "send",
    name_localizations: { "ko": "송금" },
    type: 1,
    description: "Sends cryptocurrency to given address.",
    description_localizations: { "ko": "주어진 주소로 암호화폐를 송금합니다." },
    integration_types: [1],
    contexts: [0, 1, 2],
    options: [
        {
            type: 3,
            name: "to",
            name_localizations: { "ko": "주소" },
            description: "The address to send to",
            description_localizations: { "ko": "수취인 주소" },
            required: true
        },
        {
            type: 10,
            name: "amount",
            name_localizations: { "ko": "금액" },
            description: "The amount to send",
            description_localizations: { "ko": "송금할 금액" },
            required: true,
            min_value: 0
        },
        {
            type: 3,
            name: "as",
            name_localizations: { "ko": "화폐" },
            description: "The currency to send",
            description_localizations: { "ko": "송금할 화폐" },
            required: true,
            choices: [
                {
                    name: "Tether Polygon (USDTPOL)",
                    name_localizations: {
                        "ko": "테더 폴리곤 (USDTPOL)"
                    },
                    value: "USDTPOL"
                },
                {
                    name: "Polygon (POL)",
                    name_localizations: {
                        "ko": "폴리곤 (POL)"
                    },
                    value: "POL"
                },
                {
                    name: "Tronix (TRX)",
                    name_localizations: {
                        "ko": "트론 (TRX)"
                    },
                    value: "TRX"
                },
                {
                    name: "Litecoin (LTC)",
                    name_localizations: {
                        "ko": "라이트코인 (LTC)"
                    },
                    value: "LTC"
                },
                {
                    name: "Tether Solana (USDTSOL)",
                    name_localizations: {
                        "ko": "테더 솔라나 (USDTSOL)"
                    },
                    value: "USDTSOL"
                },
                {
                    name: "Solana (SOL)",
                    name_localizations: {
                        "ko": "솔라나 (SOL)"
                    },
                    value: "SOL"
                }
            ]
        },
        {
            type: 3,
            name: "from",
            name_localizations: { "ko": "단위" },
            description: "Unit of the amount (Default: Self)",
            description_localizations: { "ko": "입력한 금액의 단위 (기본값: 코인)" },
            required: false,
            choices: [
                {
                    name: "Coin",
                    name_localizations: {
                        "ko": "코인"
                    },
                    value: "COIN"
                },
                {
                    name: "United States Dollar (USD)",
                    name_localizations: {
                        "ko": "미국 달러 (USD)"
                    },
                    value: "USD"
                },
                {
                    name: "Korean Won (KRW)",
                    name_localizations: {
                        "ko": "대한민국 원 (KRW)"
                    },
                    value: "KRW"
                },
                {
                    name: "Kimchi Premiwon (KIMCHI)",
                    name_localizations: {
                        "ko": "김치 프리미원 (KIMCHI)"
                    },
                    value: "KIMCHI"
                },
                {
                    name: "Turkish Lira (TRY)",
                    name_localizations: {
                        "ko": "튀르키예 리라 (TRY)"
                    },
                    value: "TRY"
                },
                {
                    name: "Japanese Yen (JPY)",
                    name_localizations: {
                        "ko": "일본 엔 (JPY)"
                    },
                    value: "JPY"
                },
                {
                    name: "Chinese Yuan (CNY)",
                    name_localizations: {
                        "ko": "중국 위안 (CNY)"
                    },
                    value: "CNY"
                }
            ]
        }
    ]
};

async function execute(req: Request, res: Response) {
    const [ to, amount, as, from ] = req.body.data.options;

    const db = drizzle(
        connection,
        { schema: { ...users, ...crypto }, mode: "default" }
    );

    const discordUser = req.body.user ?? req.body.member.user;
    const user = await db.select().from(users).where(eq(users.discord_id, discordUser.id));
    if (user.length === 0) {
        await db.insert(users).values({
            discord_id: discordUser.id,
            created_at: new Date()
        });
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

    res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    const currency = currencies[as.value as keyof typeof currencies];

    const description: string[] = [];
    let finalAmount = amount.value;
    if (from && from.value !== "COIN" && !(as.value.startsWith("USDT") && from.value === "USD")) {
        const binancePrice = as.value.startsWith("USDT") ? 1 : await getBinancePrice(as.value);

        if (from.value === "USD") {
            finalAmount = finalAmount / binancePrice;
        } else if (from.value === "KRW") {
            const exchangeRates = await getExchangeRates();
            finalAmount = (finalAmount / exchangeRates.USD) / binancePrice;
        } else if (from.value === "KIMCHI") { // 업비트 김치 프리미엄 대응
            const upbitPrice = await getUpbitPrice(as.value.startsWith("USDT") ? "USDT" : as.value);
            finalAmount = (finalAmount / (upbitPrice / binancePrice)) / binancePrice;
        } else if (from.value === "JPY") { // 일본(100엔) 대응
            const exchangeRates = await getExchangeRates();
            finalAmount = (((exchangeRates[from.value] / 100) / exchangeRates.USD) * finalAmount) / binancePrice;
        } else {
            const exchangeRates = await getExchangeRates();
            finalAmount = ((exchangeRates[from.value] / exchangeRates.USD) * finalAmount) / binancePrice;
        }

        finalAmount = Math.round(finalAmount * 100_000_000) / 100_000_000;

        description.push(`**${amount.value} ${from.value} ~= ${finalAmount} ${as.value.startsWith("USDT") ? "USD" : as.value}**\n`);
    }

    description.push(`${currency.emoji} ${finalAmount} -> \`${to.value}\``);

    if (from && from.value !== "COIN") {
        description.push("\n-# This is an estimate, the final amount may vary.");
    }

    if (["USDTPOL", "POL"].includes(as.value) && !Matic.isAddress(to.value)) {
        description.push("\n-# This address seems to be invalid!");
        description.push("-# Sending to this address may result in loss of funds.");
        description.push("-# Please check the address once again.");
    } else if (["USDTSOL", "SOL"].includes(as.value) && !Solana.isAddress(to.value)) {
        description.push("\n-# This address seems to be invalid!");
        description.push("-# Sending to this address may result in loss of funds.");
        description.push("-# Please check the address once again.");
    } else if (as.value === "TRX" && !Tronix.isAddress(to.value)) {
        description.push("\n-# This address seems to be invalid!");
        description.push("-# Sending to this address may result in loss of funds.");
        description.push("-# Please check the address once again.");
    } else if (as.value === "LTC" && !Litecoin.isAddress(to.value)) {
        description.push("\n-# This address seems to be invalid!");
        description.push("-# Sending to this address may result in loss of funds.");
        description.push("-# Please check the address once again.");
    } else if (["a"].includes("")) { // TODO: receive check
        description.push("\n-# This address hasn't received funds before!");
        description.push("-# Please check the address once again.");
    }

    await DiscordRequest(`/webhooks/${process.env.APP_ID}/${req.body.token}`, {
        method: "POST",
        body: JSON.stringify({
            embeds: [
                {
                    title: "💵 Send " + currency.name,
                    description: description.join("\n"),
                    color: 0x5865F2,
                    footer: {
                        text: "transactions are final; they cannot be reverted"
                    }
                }
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 3,
                            label: "Confirm",
                            custom_id: as.value === "USDTPOL" ?
                                `transfer:${finalAmount}:${to.value}` :
                                !from || from.value === "COIN" ?
                                    `fixed:${amount.value}:${finalAmount}:${as.value}:${to.value}` :
                                    `float:${amount.value}:${from.value}:${finalAmount}:${as.value}:${to.value}`
                        },
                        {
                            type: 2,
                            style: 4,
                            label: "Cancel",
                            custom_id: "cancel:" + wallet.address
                        }
                    ]
                }
            ]
        })
    });
}

async function getBinancePrice(coinSymbol: string) {
    const price = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coinSymbol}USDT`).then(res => res.json());
    return parseFloat(price.price);
}

async function getUpbitPrice(coinSymbol: string) {
    const price = await fetch(`https://api.upbit.com/v1/ticker?markets=KRW-${coinSymbol}`).then(res => res.json());
    return parseFloat(price[0].trade_price);
}

async function getExchangeRates() {
    const response = await fetch("https://obiz.kbstar.com/quics?chgCompId=b101828&baseCompId=b101828&page=C101598&cc=b101828:b101828", {
        method: "POST",
        headers: {
            "accept": "text/html, */*; q=0.01",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body: "%EC%A1%B0%ED%9A%8C%EB%85%84%EC%9B%94%EC%9D%BC=20241002&%EB%93%B1%EB%A1%9D%ED%9A%8C%EC%B0%A8=00000&monyCd=&selDate=20241002&strFocusBtn=&%EC%A1%B0%ED%9A%8C%EB%82%A0%EC%A7%9C%EA%B8%B0%EC%A4%80=&%EA%B3%A0%EC%8B%9C%ED%9A%8C%EC%B0%A8%EA%B8%B0%EC%A4%80=1&%ED%86%B5%ED%99%94%EC%84%A0%ED%83%9D%EA%B8%B0%EC%A4%80=1&btnClick=Y&%EA%B3%A0%EC%8B%9C%ED%9A%8C%EC%B0%A8%EC%84%A0%ED%83%9D=1"
    });

    const htmlString = await response.text();

    const $ = load(htmlString);

    const result: any = {};
    $('div.u-table.vertical').each((index: number, element: any) => {
        $(element).find('tbody tr').each((_: any, row: any) => {
            const currencyElement = $(row).find('td a.u-link');

            // element가 있는지 체크 (길이, 정규식)
            if (currencyElement.length > 0) {
                const currencyMatch = currencyElement.attr('onclick')?.match(/'([^']+)'/);

                if (currencyMatch) {
                    const currency = currencyMatch[1];
                    const money = parseFloat($(row).find('td.right').first().text().replace(/,/g, ''));
                    result[currency] = money;
                }
            }
        });
    });

    return result;
}

export {
    data,
    execute
};