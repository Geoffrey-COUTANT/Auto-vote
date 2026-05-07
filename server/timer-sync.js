const { setState, getState, addHistory } = require("./db");

/** Utilise si la base a encore une URL vide (ex. deploy sans « Sauvegarder »). */
const DEFAULT_VOTE_URL = "https://top-serveurs.net/gta/vote/dreamvrp";

function votePageFetchHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  };
}

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
  const trimmedUrl = String(state.vote_url || "").trim();
  const voteUrl = trimmedUrl || DEFAULT_VOTE_URL;

  const response = await fetch(voteUrl, { headers: votePageFetchHeaders(), redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Page inaccessible (${response.status}). Verifie l'URL de vote ou reessaie.`);
  }
  const html = await response.text();

  const unitTimer = extractTimerFromDataUnits(html);
  if (unitTimer) {
    const nextVoteAt = Date.now() + unitTimer.ms;
    const patch = { next_vote_at: nextVoteAt };
    if (!trimmedUrl) patch.vote_url = DEFAULT_VOTE_URL;
    const updated = await setState(patch);
    if (!skipHistory) {
      await addHistory(
        "sync",
        `Timer synchronise depuis #digitalCountdown (page vote): ${unitTimer.label}.`
      );
    }
    return { state: updated, matchedTimer: unitTimer.label };
  }

  let regex;
  try {
    regex = new RegExp(state.timer_regex || "(\\d{1,2}:\\d{2}:\\d{2})");
  } catch {
    throw new Error(
      "Regex timer invalide en base (timer_regex). Repare-la via POST /api/state ou reinitialise la ligne app_state."
    );
  }
  const match = html.match(regex);
  if (!match || !match[1]) {
    const hasBlock = /digitalCountdown/i.test(html);
    throw new Error(
      hasBlock
        ? "Compteur #digitalCountdown present mais valeurs illisibles (HTML change?). Contact / mise a jour du parser."
        : "Timer introuvable : la page renvoyee ne contient pas #digitalCountdown (anti-bot, blocage IP hebergeur, ou HTML different). Essaie depuis ton PC ou clique « Sauvegarder » avec la bonne URL."
    );
  }

  const ms = parseHmsToMs(match[1]);
  if (!ms) throw new Error("Format de timer invalide.");

  const nextVoteAt = Date.now() + ms;
  const patch = { next_vote_at: nextVoteAt };
  if (!trimmedUrl) patch.vote_url = DEFAULT_VOTE_URL;
  const updated = await setState(patch);
  if (!skipHistory) {
    await addHistory("sync", `Timer synchronise depuis l'URL: ${match[1]}.`);
  }
  return { state: updated, matchedTimer: match[1] };
}

module.exports = {
  syncTimerFromVotePage,
  extractTimerFromDataUnits,
  DEFAULT_VOTE_URL,
};
