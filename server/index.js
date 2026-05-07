require("dotenv").config();
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { initDb, getState, setState, addHistory, getHistory } = require("./db");
const { startScheduler, markVoteDone } = require("./scheduler");
const { syncTimerFromVotePage } = require("./timer-sync");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/state", async (_req, res) => {
  res.json(await getState());
});

app.post("/api/state", async (req, res) => {
  const { vote_url, vote_cooldown_minutes, next_vote_at, timer_regex } = req.body;
  const updated = await setState({
    vote_url,
    vote_cooldown_minutes:
      vote_cooldown_minutes === undefined ? undefined : Number(vote_cooldown_minutes),
    next_vote_at: next_vote_at === undefined ? undefined : Number(next_vote_at),
    timer_regex,
  });
  await addHistory("config", "Configuration mise a jour.");
  res.json(updated);
});

app.post("/api/start", async (_req, res) => {
  const updated = await setState({ is_running: 1 });
  await addHistory("state", "Automatisation activee.");
  res.json(updated);
});

app.post("/api/stop", async (_req, res) => {
  const updated = await setState({ is_running: 0 });
  await addHistory("state", "Automatisation mise en pause.");
  res.json(updated);
});

app.post("/api/opened", async (_req, res) => {
  const state = await getState();
  if (!state.next_vote_at) {
    const nextVoteAt = Date.now() + state.vote_cooldown_minutes * 60 * 1000;
    const updated = await setState({ next_vote_at: nextVoteAt });
    await addHistory("state", "Premiere ouverture de l'URL de vote.");
    return res.json(updated);
  }
  res.json(state);
});

app.post("/api/voted", async (_req, res) => {
  const updated = await markVoteDone();
  res.json(updated);
});

app.post("/api/sync-timer", async (_req, res) => {
  try {
    const result = await syncTimerFromVotePage();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/history", async (req, res) => {
  const limit = Number(req.query.limit || 30);
  res.json(await getHistory(limit));
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function start() {
  await initDb();
  startScheduler();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Serveur pret sur http://localhost:${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Echec de demarrage:", error.message);
  process.exit(1);
});
