const els = {
  voteUrl: document.querySelector("#voteUrl"),
  timer: document.querySelector("#timer"),
  history: document.querySelector("#history"),
  saveBtn: document.querySelector("#saveBtn"),
  openBtn: document.querySelector("#openBtn"),
  manualH: document.querySelector("#manualH"),
  manualM: document.querySelector("#manualM"),
  manualS: document.querySelector("#manualS"),
  manualApplyBtn: document.querySelector("#manualApplyBtn"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  votedBtn: document.querySelector("#votedBtn"),
};

let state = null;

function apiBaseUrl() {
  const meta = document.querySelector('meta[name="vote-loop-api-base"]');
  return (meta?.getAttribute("content") || "").trim().replace(/\/$/, "");
}

function apiUrl(path) {
  const pathOnly = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl();
  if (!base) return pathOnly;
  return `${base}${pathOnly}`;
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function api(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `API ${path} en erreur`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch (_error) {
      // Ignore JSON parse errors and keep default message.
    }
    throw new Error(message);
  }
  return res.json();
}

function renderState() {
  if (!state) return;
  els.voteUrl.value =
    state.vote_url || "https://top-serveurs.net/gta/vote/dreamvrp";
}

/** BIGINT Postgres peut arriver en string dans le JSON ; new Date("1712345678901") donne Invalid Date. */
function formatHistoryDate(msOrRaw) {
  const ms = typeof msOrRaw === "bigint" ? Number(msOrRaw) : Number(msOrRaw);
  if (!Number.isFinite(ms)) return "?";
  return new Date(ms).toLocaleString("fr-FR");
}

function renderHistory(items) {
  els.history.innerHTML = "";
  for (const row of items) {
    const li = document.createElement("li");
    const date = formatHistoryDate(row.created_at);
    li.textContent = `[${date}] ${row.message}`;
    els.history.appendChild(li);
  }
}

async function refresh() {
  state = await api("/api/state");
  renderState();
  const history = await api("/api/history?limit=20");
  renderHistory(history);
}

setInterval(() => {
  if (!state?.next_vote_at) {
    els.timer.textContent = "--:--:--";
    return;
  }
  const left = state.next_vote_at - Date.now();
  els.timer.textContent = formatMs(left);
}, 500);

els.saveBtn.addEventListener("click", async () => {
  state = await api("/api/state", {
    method: "POST",
    body: JSON.stringify({
      vote_url: els.voteUrl.value.trim(),
    }),
  });
  await refresh();
});

els.openBtn.addEventListener("click", async () => {
  const voteUrl = els.voteUrl.value.trim();
  if (!voteUrl) return;
  window.open(voteUrl, "_blank");
  state = await api("/api/opened", { method: "POST" });
  await refresh();
});

els.startBtn.addEventListener("click", async () => {
  state = await api("/api/start", { method: "POST" });
  await refresh();
});

els.stopBtn.addEventListener("click", async () => {
  state = await api("/api/stop", { method: "POST" });
  await refresh();
});

els.votedBtn.addEventListener("click", async () => {
  state = await api("/api/voted", { method: "POST" });
  await refresh();
});


els.manualApplyBtn.addEventListener("click", async () => {
  try {
    state = await api("/api/timer-manual", {
      method: "POST",
      body: JSON.stringify({
        hours: Number(els.manualH.value),
        minutes: Number(els.manualM.value),
        seconds: Number(els.manualS.value),
      }),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

refresh().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
