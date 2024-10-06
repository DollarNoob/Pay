export interface Currency {
    code: string;
    coin: string;
    network: string;
    name: string;
    recv: boolean;
    send: boolean;
    tag: string | null;
    logo: string;
    color: string;
    priority: number;
}

export interface Asset {
    code: string;
    network: string;
    coin: string;
    amount: string;
    rate: string;
    precision: number;
    min: string;
    max: string;
    usd: string;
    btc?: string;
}

export type ErrorCode =
    "MAINTENANCE_FROM" |
    "MAINTENANCE_TO" |
    "OFFLINE_FROM" |
    "OFFLINE_TO" |
    "RESERVE_FROM" |
    "RESERVE_TO" |
    "LIMIT_MIN" |
    "LIMIT_MAX";

export interface ExchangeRate {
    from: Asset;
    to: Asset;
    errors: ErrorCode[]
}

export type OrderStatus =
    "NEW" |
    "PENDING" |
    "EXCHANGE" |
    "WITHDRAW" |
    "DONE" |
    "EXPIRED" |
    "EMERGENCY";

export type EmergencyStatus =
    "EXPIRED" |
    "LESS" |
    "MORE" |
    "LIMIT";

export type EmergencyChoice =
    "NONE" |
    "EXCHANGE" |
    "REFUND";

export interface Transaction {
    id: string | null;
    amount: string | null;
    fee: string | null;
    ccyfee: string | null;
    timeReg: number | null;
    timeBlock: number | null;
    confirmations: number | null;
}

export interface OrderInfo {
    code: string;
    coin: string;
    network: string;
    name: string;
    alias: string;
    amount: string;
    address: string;
    tag: string | null;
    tagName: string | null;
    tx: Transaction;
}

export interface BackOrderInfo {
    code: string | null;
    coin: string | null;
    network: string | null;
    name: string | null;
    alias: string | null;
    amount: string | null;
    address: string | null;
    tag: string | null;
    tagName: string | null;
    tx: Transaction;
}

export interface Order {
    id: string;
    type: "fixed" | "float";
    email: string;
    status: OrderStatus;
    time: {
        reg: number;
        start: number | null;
        finish: number | null;
        update: number;
        expiration: number;
        left: number;
    };
    from: OrderInfo & {
        addressAlt: string | null;
        reqConfirmations: number;
        maxConfirmations: number;
    };
    to: OrderInfo;
    back: BackOrderInfo;
    emergency: {
        status: EmergencyStatus[];
        choice: EmergencyChoice;
        repeat: string;
    };
    token: string;
}