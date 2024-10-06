import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "mysql",
    schema: ["./src/schemas/users.ts", "./src/schemas/crypto.ts", "./src/schemas/payments.ts"],
    out: "./migrations"
});