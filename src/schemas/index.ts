import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as users from "./users";
import * as crypto from "./crypto";
import * as payments from "./payments";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";

export default async function connect() {
    global.connection = await mysql.createConnection({
        host: process.env.MARIADB_HOST,
        user: process.env.MARIADB_USER,
        password: process.env.MARIADB_PASSWORD,
        database: process.env.MARIADB_DATABASE
    });

    /*const db = drizzle(
        connection,
        { schema: { ...users, ...crypto, ...payments }, mode: "default" }
    );

    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../migrations') });*/

    console.log("[MariaDB] Connected");
}