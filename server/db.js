const Database = require("better-sqlite3");
const path = require("node:path");

const dbPath = path.join(__dirname, "..", "data.sqlite");
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  vote_url TEXT NOT NULL DEFAULT '',
  is_running INTEGER NOT NULL DEFAULT 0,
  next_vote_at INTEGER,
  vote_cooldown_minutes INTEGER NOT NULL DEFAULT 120,
  timer_regex TEXT NOT NULL DEFAULT '(\\d{1,2}:\\d{2}:\\d{2})',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

const now = Date.now();
db.prepare(
  `
  INSERT INTO app_state (id, vote_url, is_running, next_vote_at, vote_cooldown_minutes, timer_regex, created_at, updated_at)
  VALUES (1, '', 0, NULL, 120, '(\\d{1,2}:\\d{2}:\\d{2})', ?, ?)
  ON CONFLICT(id) DO NOTHING
`
).run(now, now);

const cols = db.prepare("PRAGMA table_info(app_state)").all();
if (!cols.find((c) => c.name === "timer_regex")) {
  db.exec(
    "ALTER TABLE app_state ADD COLUMN timer_regex TEXT NOT NULL DEFAULT '(\\d{1,2}:\\d{2}:\\d{2})'"
  );
}

function getState() {
  return db.prepare("SELECT * FROM app_state WHERE id = 1").get();
}

function setState(patch) {
  const current = getState();
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

  db.prepare(
    `
    UPDATE app_state
    SET vote_url = @vote_url,
        is_running = @is_running,
        next_vote_at = @next_vote_at,
        vote_cooldown_minutes = @vote_cooldown_minutes,
        timer_regex = @timer_regex,
        updated_at = @updated_at
    WHERE id = 1
  `
  ).run(next);

  return getState();
}

function addHistory(type, message) {
  db.prepare(
    "INSERT INTO history (type, message, created_at) VALUES (?, ?, ?)"
  ).run(type, message, Date.now());
}

function getHistory(limit = 50) {
  return db
    .prepare("SELECT * FROM history ORDER BY created_at DESC LIMIT ?")
    .all(limit);
}

module.exports = {
  getState,
  setState,
  addHistory,
  getHistory,
};
