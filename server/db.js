const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquante. Configure PostgreSQL dans le .env pour lancer l'application."
  );
}

const sslEnabled = process.env.PGSSL === "false" ? false : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString,
  ssl: sslEnabled,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      vote_url TEXT NOT NULL DEFAULT '',
      is_running INTEGER NOT NULL DEFAULT 0,
      next_vote_at BIGINT,
      vote_cooldown_minutes INTEGER NOT NULL DEFAULT 120,
      timer_regex TEXT NOT NULL DEFAULT '(\\d{1,2}:\\d{2}:\\d{2})',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS history (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  const now = Date.now();
  await pool.query(
    `
      INSERT INTO app_state (id, vote_url, is_running, next_vote_at, vote_cooldown_minutes, timer_regex, created_at, updated_at)
      VALUES (1, '', 0, NULL, 120, '(\\d{1,2}:\\d{2}:\\d{2})', $1, $2)
      ON CONFLICT (id) DO NOTHING
    `,
    [now, now]
  );
}

async function getState() {
  const { rows } = await pool.query("SELECT * FROM app_state WHERE id = 1");
  return rows[0];
}

async function setState(patch) {
  const current = await getState();
  const next = {
    vote_url: patch.vote_url ?? current.vote_url,
    is_running:
      patch.is_running === undefined ? current.is_running : Number(Boolean(patch.is_running)),
    next_vote_at:
      patch.next_vote_at === undefined ? current.next_vote_at : patch.next_vote_at,
    vote_cooldown_minutes:
      patch.vote_cooldown_minutes ?? current.vote_cooldown_minutes,
    timer_regex: patch.timer_regex ?? current.timer_regex,
    updated_at: Date.now(),
  };

  await pool.query(
    `
      UPDATE app_state
      SET vote_url = $1,
          is_running = $2,
          next_vote_at = $3,
          vote_cooldown_minutes = $4,
          timer_regex = $5,
          updated_at = $6
      WHERE id = 1
    `,
    [
      next.vote_url,
      next.is_running,
      next.next_vote_at,
      next.vote_cooldown_minutes,
      next.timer_regex,
      next.updated_at,
    ]
  );

  return getState();
}

async function addHistory(type, message) {
  await pool.query("INSERT INTO history (type, message, created_at) VALUES ($1, $2, $3)", [
    type,
    message,
    Date.now(),
  ]);
}

async function getHistory(limit = 50) {
  const safeLimit = Number(limit) > 0 ? Number(limit) : 50;
  const { rows } = await pool.query(
    "SELECT * FROM history ORDER BY created_at DESC LIMIT $1",
    [safeLimit]
  );
  return rows;
}

module.exports = {
  initDb,
  getState,
  setState,
  addHistory,
  getHistory,
};
