import crypto from "crypto";
import { Currency, ExchangeRate, Order } from "./types/FixedFloat";

class FixedFloat {
    private _apiKey: string;
    private _apiSecret: string;

    constructor(apiKey: string, apiSecret: string) {
        this._apiKey = apiKey;
        this._apiSecret = apiSecret;
    }

    get apiKey() {
        return this._apiKey;
    }

    get apiSecret() {
        return this._apiSecret;
    }

    signPayload(payload: string | object) {
        if (typeof payload === "object") payload = JSON.stringify(payload);
        return crypto.createHmac("sha256", this._apiSecret).update(payload).digest("hex");
    }

    async availableCurrencies(): Promise<Currency[]> {
        const currencies = await fetch("https://ff.io/api/v2/ccies", {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
                "X-API-KEY": this._apiKey,
                "X-API-SIGN": this.signPayload("")
            },
            method: "POST"
        }).then(res => res.json());

        if (currencies.code !== 0) {
            throw new Error(currencies.msg);
        }

        return currencies.data;
    }

    async exchangeRate(type: "fixed" | "float", fromCurrency: string, toCurrency: string, direction: "from" | "to", amount: number): Promise<ExchangeRate> {
        const payload = {
            type,
            fromCcy: fromCurrency,
            toCcy: toCurrency,
            direction,
            amount
        };

        const price = await fetch("https://ff.io/api/v2/price", {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
                "X-API-KEY": this._apiKey,
                "X-API-SIGN": this.signPayload(payload)
            },
            method: "POST",
            body: JSON.stringify(payload)
        }).then(res => res.json());

        if (price.code !== 0) {
            throw new Error(price.msg);
        }

        return price.data;
    }

    async createOrder(type: "fixed" | "float", fromCurrency: string, toCurrency: string, direction: "from" | "to", amount: number, to: string): Promise<Order> {
        const payload = {
            type,
            fromCcy: fromCurrency,
            toCcy: toCurrency,
            direction,
            amount,
            toAddress: to
        };

        const order = await fetch("https://ff.io/api/v2/create", {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
                "X-API-KEY": this._apiKey,
                "X-API-SIGN": this.signPayload(payload)
            },
            method: "POST",
            body: JSON.stringify(payload)
        }).then(res => res.json());

        if (order.code !== 0) {
            throw new Error(order.msg);
        }

        return order.data;
    }

    async getOrder(id: string, token: string): Promise<Order> {
        const payload = {
            id,
            token
        };

        const order = await fetch("https://ff.io/api/v2/order", {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
                "X-API-KEY": this._apiKey,
                "X-API-SIGN": this.signPayload(payload)
            },
            method: "POST",
            body: JSON.stringify(payload)
        }).then(res => res.json());

        if (order.code !== 0) {
            throw new Error(order.msg);
        }

        return order.data;
    }

    async executeEmergency(id: string, token: string, choice: "EXCHANGE" | "REFUND", address?: string): Promise<boolean> {
        const payload = {
            id,
            token,
            choice,
            address
        };

        const order = await fetch("https://ff.io/api/v2/order", {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
                "X-API-KEY": this._apiKey,
                "X-API-SIGN": this.signPayload(payload)
            },
            method: "POST",
            body: JSON.stringify(payload)
        }).then(res => res.json());

        if (order.code !== 0) {
            throw new Error(order.msg);
        }

        return order.data;
    }
}

export default FixedFloat;