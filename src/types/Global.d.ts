import mysql from "mysql2/promise";

declare global {
    var connection: mysql.Connection;
}

export default global;