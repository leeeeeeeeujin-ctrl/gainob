const { Pool } = require("pg");

let pool;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || "";
}

function hasDatabaseConfig() {
  return Boolean(getDatabaseUrl());
}

function getPool() {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function getDatabaseStatus() {
  if (!hasDatabaseConfig()) {
    return {
      connected: false,
      configured: false
    };
  }

  try {
    const result = await query("select now() as now, current_database() as database_name");

    return {
      connected: true,
      configured: true,
      databaseName: result.rows[0]?.database_name || null,
      now: result.rows[0]?.now || null
    };
  } catch (error) {
    return {
      connected: false,
      configured: true,
      error: error.message
    };
  }
}

module.exports = {
  hasDatabaseConfig,
  query,
  getDatabaseStatus
};
