const cron = require("node-cron");
const { getState, setState, addHistory } = require("./db");
const { notifyVoteReady } = require("./notifier");
const { syncTimerFromVotePage } = require("./timer-sync");

let notificationSentFor = null;

function computeNextVoteFromNow(minutes) {
  return Date.now() + minutes * 60 * 1000;
}

async function tick() {
  const state = await getState();
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
    await addHistory("notify", `Rappel envoye pour voter: ${state.vote_url}`);
  } catch (error) {
    await addHistory("error", `Echec notification: ${error.message}`);
  } finally {
    notificationSentFor = state.next_vote_at;
  }
}

function startScheduler() {
  cron.schedule("* * * * *", () => {
    tick().catch(() => {});
  });
}

async function markVoteDone() {
  const state = await getState();
  try {
    const result = await syncTimerFromVotePage({ skipHistory: true });
    await addHistory(
      "vote",
      `Vote confirme. Prochain delai depuis la page (#digitalCountdown): ${result.matchedTimer}.`
    );
    return result.state;
  } catch (_error) {
    const nextVoteAt = computeNextVoteFromNow(state.vote_cooldown_minutes);
    const updated = await setState({ next_vote_at: nextVoteAt });
    await addHistory(
      "vote",
      `Vote confirme. Sync page impossible; fallback ${updated.vote_cooldown_minutes} min.`
    );
    return updated;
  }
}

module.exports = {
  startScheduler,
  markVoteDone,
};
