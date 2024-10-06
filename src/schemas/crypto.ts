import { mysqlTable, int, bigint, text, datetime } from "drizzle-orm/mysql-core";
import { users } from "./users";

export const crypto = mysqlTable("crypto", {
    id: int("id").autoincrement().primaryKey(),
    user_id: int("user_id").references(() => users.id).notNull(),
    public_key: text("public_key").notNull(),
    private_key: text("private_key").notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull()
});

export type Crypto = typeof crypto.$inferSelect;
export type NewCrypto = typeof crypto.$inferInsert;