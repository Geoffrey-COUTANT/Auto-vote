require("dotenv").config();
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { getState, setState, addHistory, getHistory } = require("./db");
const { startScheduler, markVoteDone } = require("./scheduler");
const { syncTimerFromVotePage } = require("./timer-sync");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/state", (_req, res) => {
  res.json(getState());
});

app.post("/api/state", (req, res) => {
  const { vote_url, vote_cooldown_minutes, next_vote_at, timer_regex } = req.body;
  const updated = setState({
    vote_url,
    vote_cooldown_minutes:
      vote_cooldown_minutes === undefined ? undefined : Number(vote_cooldown_minutes),
    next_vote_at: next_vote_at === undefined ? undefined : Number(next_vote_at),
    timer_regex,
  });
  addHistory("config", "Configuration mise a jour.");
  res.json(updated);
});

app.post("/api/start", (_req, res) => {
  const updated = setState({ is_running: 1 });
  addHistory("state", "Automatisation activee.");
  res.json(updated);
});

app.post("/api/stop", (_req, res) => {
  const updated = setState({ is_running: 0 });
  addHistory("state", "Automatisation mise en pause.");
  res.json(updated);
});

app.post("/api/opened", (_req, res) => {
  const state = getState();
  if (!state.next_vote_at) {
    const nextVoteAt = Date.now() + state.vote_cooldown_minutes * 60 * 1000;
    const updated = setState({ next_vote_at: nextVoteAt });
    addHistory("state", "Premiere ouverture de l'URL de vote.");
    return res.json(updated);
  }
  res.json(state);
});

app.post("/api/voted", (_req, res) => {
  const updated = markVoteDone();
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

app.get("/api/history", (req, res) => {
  const limit = Number(req.query.limit || 30);
  res.json(getHistory(limit));
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

startScheduler();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Serveur pret sur http://localhost:${port}`);
});
