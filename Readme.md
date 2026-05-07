# Vote Loop - PWA + Backend

Application PWA iOS + backend Node.js pour gerer un cycle de vote en boucle avec PostgreSQL:

- Timer visible dans la PWA
- Start/Stop de l'automatisation
- Ouverture manuelle de la page de vote
- Bouton "J'ai vote" pour recalculer le prochain timer **depuis la page** (`#digitalCountdown` sur Top Serveurs)
- Bouton optionnel **Sync timer depuis URL** (meme lecture serveur)
- Historique des actions
- Notifications Discord/Telegram quand le timer arrive a 0
- Fonctionne meme si la PWA est fermee (car le scheduler tourne sur le serveur)
- Stockage persistant PostgreSQL (stable pour la production)

**Timer:** le serveur telecharge l'URL de vote et lit les segments `data-unit="hours|minutes|seconds"` dans la zone du compteur (`id="digitalCountdown"`). L'URL par defaut est celle du vote DreamV sur Top Serveurs.

Si la page est inaccessible ou le compteur absent, un **fallback** interne utilise encore `vote_cooldown_minutes` (120 par defaut en base), configurable via l'API `/api/state` si besoin — plus via le formulaire PWA.

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

1. Verifie l'URL de vote (par defaut: `https://top-serveurs.net/gta/vote/dreamvrp`), puis `Sauvegarder` si tu la changes
2. Clique `Ouvrir la page de vote` (la premiere fois, le timer est synchronise depuis `#digitalCountdown` sur la page)
3. Active la boucle avec `Start`
4. Quand tu votes, clique `J'ai vote` pour relancer le cycle (nouvelle lecture du compteur sur la page)
5. Optionnel: clique `Sync timer depuis URL` pour forcer une mise a jour sans avoir vote

## Notes importantes

- La PWA n'auto-clique pas sur le bouton voter.
- L'ouverture d'URL reste une action utilisateur (bouton), mais les rappels et la logique de boucle tournent cote serveur.