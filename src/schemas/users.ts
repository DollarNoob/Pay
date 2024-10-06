import { mysqlTable, int, bigint, varchar, datetime } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
    id: int("id").autoincrement().primaryKey(),
    discord_id: bigint("discord_id", { mode: "number", unsigned: true }).notNull(),
    created_at: datetime("created_at", { mode: "date" }).notNull(),
    access_token: varchar("access_token", { length: 30 }),
    refrsesh_token: varchar("refresh_token", { length: 30 }),
    email: varchar("email", { length: 128 }),
    locale: varchar("locale", { length: 5 })
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;