async function sendDiscord(webhookUrl, content) {
  if (!webhookUrl) return false;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status}`);
  }

  return true;
}

async function sendTelegram(botToken, chatId, text) {
  if (!botToken || !chatId) return false;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram API error: ${res.status}`);
  }

  return true;
}

async function notifyVoteReady(voteUrl) {
  const message = `Timer fini. Tu peux voter maintenant: ${voteUrl}`;

  const tasks = [];
  if (process.env.DISCORD_WEBHOOK_URL) {
    tasks.push(sendDiscord(process.env.DISCORD_WEBHOOK_URL, message));
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    tasks.push(
      sendTelegram(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, message)
    );
  }

  if (tasks.length === 0) {
    return { sent: false, reason: "no_channels_configured" };
  }

  await Promise.all(tasks);
  return { sent: true };
}

module.exports = {
  notifyVoteReady,
};
