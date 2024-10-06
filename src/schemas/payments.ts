import { mysqlTable, int, bigint, text, varchar, datetime } from "drizzle-orm/mysql-core";
import { users } from "./users";

export const payments = mysqlTable("payments", {
    id: int("id").autoincrement().primaryKey(),
    user_id: int("user_id").references(() => users.id).notNull(),
    txid: text("txid"),
    order_id: varchar("order_id", { length: 6 }).notNull(),
    order_token: varchar("order_token", { length: 40 }).notNull(),
    amount: text("amount").notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    exchanged_at: datetime("exchanged_at", { mode: "date" }),
    exchanged_txid: text("exchanged_txid"),
    exchanged_currency: varchar("exchanged_currency", { length: 16 }),
    exchanged_amount: text("exchanged_amount")
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;