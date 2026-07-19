/**
 * start-dev.js
 * Boots an embedded PostgreSQL, runs Prisma migrations, then starts the Express server.
 * Use this for local development without a system PostgreSQL installation.
 */
require('dotenv').config();
const EmbeddedPostgresModule = require('embedded-postgres');
const EmbeddedPostgres = EmbeddedPostgresModule.default || EmbeddedPostgresModule;
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PG_PORT = 5432;
const PG_USER = 'postgres';
const PG_PASSWORD = 'postgres';
const PG_DB = 'taskflow_ai';
const PRISMA_BIN = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const PG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-ai-pg-'));
const TRACE_LOG = path.join(__dirname, 'start-dev.trace.log');

// Keep Prisma cache writes inside the workspace so the app can boot in sandboxed dev environments.
process.env.HOME = __dirname;
process.env.USERPROFILE = __dirname;
process.env.PRISMA_HOME = path.join(__dirname, '.prisma-cache');

function trace(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(TRACE_LOG, line);
  } catch (err) {
    // Ignore trace failures; console is still helpful during foreground runs.
  }
  console.log(message);
}

async function main() {
  trace('📦 Starting embedded PostgreSQL...');

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: false,
  });

  try {
    await pg.initialise();
    await pg.start();
    trace(`✅ Embedded PostgreSQL running on port ${PG_PORT}`);

    // Create database if it doesn't exist
    try {
      await pg.createDatabase(PG_DB);
      trace(`✅ Database "${PG_DB}" ready.`);
    } catch (e) {
      // Database may already exist
      if (!e.message.includes('already exists')) {
        trace(`⚠️  createDatabase warning: ${e.message}`);
      } else {
        trace(`✅ Database "${PG_DB}" already exists.`);
      }
    }

    // Set DATABASE_URL for this process
    process.env.DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}?schema=public`;

    // Run Prisma migrations
    trace('🔄 Running Prisma database migrations...');
    execSync(`"${PRISMA_BIN}" migrate deploy`, {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    trace('✅ Migrations applied successfully!');

  } catch (err) {
    if (err.message && err.message.includes('already in use')) {
      // Port already in use — PostgreSQL already running from a prior session
      trace('ℹ️  PostgreSQL appears to already be running. Skipping embedded boot...');
      process.env.DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}?schema=public`;

      try {
        trace('🔄 Running Prisma migrate deploy...');
        execSync(`"${PRISMA_BIN}" migrate deploy`, {
          cwd: __dirname,
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        });
      } catch (migErr) {
        trace(`⚠️  Migration warning (tables may already exist): ${migErr.message}`);
      }
    } else {
      trace(`❌ Failed to start embedded PostgreSQL: ${err.message}`);
      process.exit(1);
    }
  }

  // Now start the Express server
  trace('\n🚀 Starting TaskFlow AI backend server...');
  require('./src/index.js');
}

main();
