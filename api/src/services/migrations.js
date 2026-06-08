const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigrations() {
  // Path resolved relatively from api/src/services/
  const migrationsDir = path.join(__dirname, '../../../db/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`WARNING: Migrations directory not found at: ${migrationsDir}. Skipping database migration execution.`);
    return;
  }

  // Ensure migrations log table is initialized
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  // Load and sort .sql migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[MIGRATOR] Found ${files.length} migration files in folder.`);

  for (const file of files) {
    const alreadyRun = await db.query('SELECT id FROM migrations_history WHERE name = ?', [file]);
    if (alreadyRun.length > 0) {
      console.log(`[MIGRATOR] Skipping already executed migration: ${file}`);
      continue;
    }

    console.log(`[MIGRATOR] Executing migration file: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    const connection = await db.pool.getConnection();
    try {
      await connection.query(sql);
      await connection.query('INSERT INTO migrations_history (name) VALUES (?)', [file]);
      console.log(`[MIGRATOR] Migration successfully completed: ${file}`);
    } catch (err) {
      console.error(`[MIGRATOR] ERROR executing migration ${file}:`, err.message);
      throw err;
    } finally {
      connection.release();
    }
  }
  console.log('[MIGRATOR] Database migrations sync complete.');
}

module.exports = {
  runMigrations
};
