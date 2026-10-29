const mysql = require('mysql2/promise');
require('dotenv').config();

const conexao = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: process.env.DB_SSL === 'true'
        ? {
            ca: process.env.DB_SSL_CA
        }
        : undefined
});

module.exports = conexao;