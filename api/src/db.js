const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'enderthoughts',
  user: process.env.DB_USER || 'root',
  // DB_APP_PASS is the least-privilege app user's password (pairs with DB_USER);
  // DB_PASS (the MySQL root password) remains only as a legacy fallback so
  // old root-based .env files keep working.
  password: process.env.DB_APP_PASS || process.env.DB_PASS || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
  // multipleStatements is deliberately OFF for the shared pool — only the
  // migration runner needs it (it opens its own connection).
});

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params).then(([rows]) => rows)
};
