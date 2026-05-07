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

function sliceAroundDigitalCountdown(html) {
  const needle = /id\s*=\s*["']digitalCountdown["']/i;
  const match = needle.exec(html);
  if (!match || match.index === undefined) return html;
  return html.slice(match.index, match.index + 4000);
}

function extractTimerFromDataUnits(html) {
  const scoped = sliceAroundDigitalCountdown(html);

  const getUnit = (unit) => {
    const regex = new RegExp(
      `<span[^>]*data-unit=["']${unit}["'][^>]*>\\s*(\\d{1,2})\\s*<\\/span>`,
      "i"
    );
    const match = scoped.match(regex);
    return match ? Number(match[1]) : null;
  };

  const hours = getUnit("hours");
  const minutes = getUnit("minutes");
  const seconds = getUnit("seconds");

  if (hours === null || minutes === null || seconds === null) {
    return null;
  }

  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  const label = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  return { ms, label };
}

async function syncTimerFromVotePage(options = {}) {
  const { skipHistory = false } = options;
  const state = await getState();
  if (!state.vote_url) throw new Error("Aucune URL de vote configuree.");

  const response = await fetch(state.vote_url);
  if (!response.ok) throw new Error(`Page inaccessible (${response.status}).`);
  const html = await response.text();

  const unitTimer = extractTimerFromDataUnits(html);
  if (unitTimer) {
    const nextVoteAt = Date.now() + unitTimer.ms;
    const updated = await setState({ next_vote_at: nextVoteAt });
    if (!skipHistory) {
      await addHistory(
        "sync",
        `Timer synchronise depuis #digitalCountdown (page vote): ${unitTimer.label}.`
      );
    }
    return { state: updated, matchedTimer: unitTimer.label };
  }

  const regex = new RegExp(state.timer_regex || "(\\d{1,2}:\\d{2}:\\d{2})");
  const match = html.match(regex);
  if (!match || !match[1]) {
    throw new Error("Timer introuvable sur la page avec la regex actuelle.");
  }

  const ms = parseHmsToMs(match[1]);
  if (!ms) throw new Error("Format de timer invalide.");

  const nextVoteAt = Date.now() + ms;
  const updated = await setState({ next_vote_at: nextVoteAt });
  if (!skipHistory) {
    await addHistory("sync", `Timer synchronise depuis l'URL: ${match[1]}.`);
  }
  return { state: updated, matchedTimer: match[1] };
}

module.exports = {
  syncTimerFromVotePage,
  extractTimerFromDataUnits,
};
