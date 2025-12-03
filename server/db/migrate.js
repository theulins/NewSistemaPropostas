import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_TABLE = 'migrations';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '..', 'migrations');

let pool = null;

// 1) Garante que o banco exista (conexão SEM database)
async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
    // sem "database" aqui!
  });

  const dbName = process.env.DB_NAME;

  if (!dbName) {
    throw new Error('DB_NAME não definido no .env');
  }

  await connection.query(`
    CREATE DATABASE IF NOT EXISTS \`${dbName}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
  `);

  console.log(`✔ Banco '${dbName}' garantido/validado.`);
  await connection.end();
}

// 2) Cria (ou reaproveita) um pool já apontando para o banco criado
async function getPool() {
  if (!pool) {
    await ensureDatabase(); // garante o banco antes de criar o pool

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 10,
      namedPlaceholders: true,
      timezone: 'Z'
    });
  }
  return pool;
}

async function ensureMigrationsTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function loadMigrationFiles() {
  try {
    const files = await fs.readdir(migrationsDir);
    return files.filter((file) => file.endsWith('.js')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function getExecutedMigrations() {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`
  );
  return new Set(rows.map((row) => row.name));
}

async function runPendingMigrations(migrationFiles) {
  if (migrationFiles.length === 0) {
    console.log('Nenhuma migration encontrada.');
    return;
  }

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const pool = await getPool();

  for (const fileName of migrationFiles) {
    if (executed.has(fileName)) {
      console.log(`Migration já executada: ${fileName}`);
      continue;
    }

    const filePath = path.join(migrationsDir, fileName);
    const migrationModule = await import(pathToFileURL(filePath).href);

    if (typeof migrationModule.up !== 'function') {
      throw new Error(
        `Migration ${fileName} não exporta uma função up(connection).`
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await migrationModule.up(connection);
      await connection.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
        [fileName]
      );
      await connection.commit();
      console.log(`Migration aplicada: ${fileName}`);
    } catch (error) {
      await connection.rollback();
      error.message = `Erro ao executar migration ${fileName}: ${error.message}`;
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function main() {
  try {
    const migrationFiles = await loadMigrationFiles();
    await runPendingMigrations(migrationFiles);

    if (pool) {
      await pool.end();
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    try {
      if (pool) {
        await pool.end();
      }
    } catch (endError) {
      console.error(endError);
    }
    process.exit(1);
  }
}

const cliScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (import.meta.url === cliScript) {
  main();
}

export default main;
