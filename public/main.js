const els = {
  voteUrl: document.querySelector("#voteUrl"),
  timer: document.querySelector("#timer"),
  history: document.querySelector("#history"),
  saveBtn: document.querySelector("#saveBtn"),
  openBtn: document.querySelector("#openBtn"),
  syncBtn: document.querySelector("#syncBtn"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  votedBtn: document.querySelector("#votedBtn"),
};

let state = null;

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
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

function renderHistory(items) {
  els.history.innerHTML = "";
  for (const row of items) {
    const li = document.createElement("li");
    const date = new Date(row.created_at).toLocaleString("fr-FR");
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

els.syncBtn.addEventListener("click", async () => {
  try {
    await api("/api/sync-timer", { method: "POST" });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

refresh().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
});
