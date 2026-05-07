const { setState, getState, addHistory } = require("./db");

function parseHmsToMs(value) {
  const parts = value.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return null;
}

async function syncTimerFromVotePage() {
  const state = getState();
  if (!state.vote_url) throw new Error("Aucune URL de vote configuree.");

  const response = await fetch(state.vote_url);
  if (!response.ok) throw new Error(`Page inaccessible (${response.status}).`);
  const html = await response.text();

  const regex = new RegExp(state.timer_regex || "(\\d{1,2}:\\d{2}:\\d{2})");
  const match = html.match(regex);
  if (!match || !match[1]) {
    throw new Error("Timer introuvable sur la page avec la regex actuelle.");
  }

  const ms = parseHmsToMs(match[1]);
  if (!ms) throw new Error("Format de timer invalide.");

  const nextVoteAt = Date.now() + ms;
  const updated = setState({ next_vote_at: nextVoteAt });
  addHistory("sync", `Timer synchronise depuis l'URL: ${match[1]}.`);
  return { state: updated, matchedTimer: match[1] };
}

module.exports = {
  syncTimerFromVotePage,
};
