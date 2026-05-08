const { setState, getState, addHistory } = require("./db");

/** Utilise si la base a encore une URL vide (ex. deploy sans « Sauvegarder »). */
const DEFAULT_VOTE_URL = "https://top-serveurs.net/gta/vote/dreamvrp";

const DIGITAL_COUNTDOWN_WINDOW = 16_000;
const COOLDOWN_CARD_WINDOW = 28_000;

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

function sliceFromMatchIndex(html, index, length) {
  if (index === undefined || index < 0) return null;
  return html.slice(index, index + length);
}

function sliceAroundDigitalCountdown(html) {
  const needle = /id\s*=\s*["']digitalCountdown["']/i;
  const match = needle.exec(html);
  return sliceFromMatchIndex(html, match?.index, DIGITAL_COUNTDOWN_WINDOW);
}

/** Bloc « Veuillez patienter » + compteur (structure Top Serveurs). */
function sliceAroundCooldownCard(html) {
  const match = /\bclass\s*=\s*["'][^"']*\bcooldown-card\b[^"']*["']/i.exec(html);
  return sliceFromMatchIndex(html, match?.index, COOLDOWN_CARD_WINDOW);
}

/** Extrait h/m/s depuis les <span data-unit="hours|minutes|seconds"> dans un morceau HTML. */
function extractHmsFromDataUnitSpans(scopedHtml) {
  if (!scopedHtml) return null;

  const getUnit = (unit) => {
    const regex = new RegExp(
      `<span\\b[^>]*\\bdata-unit\\s*=\\s*["']${unit}["'][^>]*>\\s*(\\d{1,2})\\s*<\\/span>`,
      "i"
    );
    const match = scopedHtml.match(regex);
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

function extractFromDigitalCountdownSpans(html) {
  const windows = [];
  const byId = sliceAroundDigitalCountdown(html);
  if (byId) windows.push(byId);
  const card = sliceAroundCooldownCard(html);
  if (card) windows.push(card);
  windows.push(html);

  const seen = new Set();
  for (const chunk of windows) {
    if (!chunk || seen.has(chunk)) continue;
    seen.add(chunk);
    const found = extractHmsFromDataUnitSpans(chunk);
    if (found && found.ms > 0) return found;
  }
  return null;
}

/**
 * Texte du type « 52m 30s », « 1h 5m », « 0h 0m 30s » (bloc #voteTimer / .cooldown-time).
 */
function parseCompactDurationText(raw) {
  const text = String(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  const hM = text.match(/(\d+)\s*h\b/i);
  const mM = text.match(/(\d+)\s*m\b/i);
  const sM = text.match(/(\d+)\s*s\b/i);
  if (hM) hours = Number(hM[1]);
  if (mM) minutes = Number(mM[1]);
  if (sM) seconds = Number(sM[1]);
  if (!hM && !mM && !sM) return null;

  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const label = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
  return { ms, label };
}

function extractFromCooldownTimeSpan(html) {
  const re = /<span[^>]*\bcooldown-time\b[^>]*>([\s\S]*?)<\/span>/i;
  const match = html.match(re);
  if (!match) return null;
  return parseCompactDurationText(match[1]);
}

function extractFromVoteTimerBlock(html) {
  const re = /id\s*=\s*["']voteTimer["'][^>]*>([\s\S]*?)<\/strong>/i;
  const match = html.match(re);
  if (!match) return null;
  return parseCompactDurationText(match[1]);
}

function extractTimerFromDataUnits(html) {
  const fromSpans = extractFromDigitalCountdownSpans(html);
  if (fromSpans) return { ...fromSpans, source: "#digitalCountdown" };

  const fromCool = extractFromCooldownTimeSpan(html);
  if (fromCool) return { ...fromCool, source: ".cooldown-time" };

  const fromVote = extractFromVoteTimerBlock(html);
  if (fromVote) return { ...fromVote, source: "#voteTimer" };

  return null;
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
        `Timer synchronise depuis la page (${unitTimer.source}): ${unitTimer.label}.`
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
    const hasCooldownUi =
      /\bcooldown-card\b/i.test(html) ||
      /id\s*=\s*["']digitalCountdown["']/i.test(html) ||
      /\bcooldown-time\b/i.test(html);
    throw new Error(
      hasCooldownUi
        ? "Compteur cooldown detecte dans le HTML mais valeurs illisibles (structure changee ?). Utilise la saisie manuelle ou mets a jour le parser."
        : "Timer introuvable : la page renvoyee ne contient pas le bloc cooldown (HTML different, anti-bot, ou IP hebergeur). Essaie la saisie manuelle."
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
