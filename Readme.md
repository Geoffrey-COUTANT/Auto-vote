# Vote Loop - PWA + Backend

Application PWA iOS + backend Node.js pour gerer un cycle de vote en boucle avec PostgreSQL:

- Timer visible dans la PWA
- Start/Stop de l'automatisation
- Ouverture manuelle de la page de vote
- Bouton "J'ai vote" pour recalculer le prochain timer
- Synchronisation du timer depuis l'URL via regex configurable
- Historique des actions
- Notifications Discord/Telegram quand le timer arrive a 0
- Fonctionne meme si la PWA est fermee (car le scheduler tourne sur le serveur)
- Stockage persistant PostgreSQL (stable pour la production)

## Installation

```bash
npm install
cp .env.example .env
```

Puis configure `.env`:

- `DATABASE_URL` (obligatoire)
- `PGSSL` (`false` en local, `true` sur Render/Railway)

Puis ajoute si tu veux des notifications:

- `DISCORD_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## Lancer

```bash
npm start
```

Ouvre ensuite:

[http://localhost:3000](http://localhost:3000)

## PostgreSQL sur Render (recommande)

1. Cree une base PostgreSQL Render
2. Copie `External Database URL`
3. Colle cette valeur dans la variable d'environnement `DATABASE_URL` de ton service web
4. Mets `PGSSL=true`
5. Redeploie le service

## Utilisation

1. Renseigne l'URL de vote
2. Mets le cooldown (minutes) ou la regex du timer trouve sur la page
3. Clique `Sauvegarder`
4. Clique `Ouvrir la page de vote` (premiere fois)
5. Active la boucle avec `Start`
6. Quand tu votes, clique `J'ai vote` pour relancer le cycle
7. Optionnel: clique `Sync timer depuis URL` pour recuperer le timer exact depuis la page

## Notes importantes

- La PWA n'auto-clique pas sur le bouton voter.
- L'ouverture d'URL reste une action utilisateur (bouton), mais les rappels et la logique de boucle tournent cote serveur.