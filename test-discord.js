require("dotenv").config();
const { notifyVoteReady } = require("./server/notifier");

(async () => {
  console.log("Envoi de la notification test Discord...");
  try {
    const result = await notifyVoteReady("http://ton-site-de-vote.com/test");
    if (result.sent) {
      console.log("✅ Notification test envoyée avec succès sur Discord !");
    } else {
      console.log("⚠️ Aucune notification envoyée. Raison:", result.reason);
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi :", error.message);
  }
})();
