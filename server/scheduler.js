const cron = require("node-cron");
const { getState, setState, addHistory } = require("./db");
const { notifyVoteReady } = require("./notifier");

let notificationSentFor = null;

function computeNextVoteFromNow(minutes) {
  return Date.now() + minutes * 60 * 1000;
}

async function tick() {
  const state = getState();
  if (!state.is_running || !state.next_vote_at || !state.vote_url) {
    notificationSentFor = null;
    return;
  }

  if (Date.now() < state.next_vote_at) {
    notificationSentFor = null;
    return;
  }

  if (notificationSentFor === state.next_vote_at) {
    return;
  }

  try {
    await notifyVoteReady(state.vote_url);
    addHistory("notify", `Rappel envoyé pour voter: ${state.vote_url}`);
  } catch (error) {
    addHistory("error", `Echec notification: ${error.message}`);
  } finally {
    notificationSentFor = state.next_vote_at;
  }
}

function startScheduler() {
  cron.schedule("* * * * *", tick);
}

function markVoteDone() {
  const state = getState();
  const nextVoteAt = computeNextVoteFromNow(state.vote_cooldown_minutes);
  const updated = setState({ next_vote_at: nextVoteAt });
  addHistory(
    "vote",
    `Vote confirmé. Prochain timer dans ${updated.vote_cooldown_minutes} minutes.`
  );
  return updated;
}

module.exports = {
  startScheduler,
  markVoteDone,
};
