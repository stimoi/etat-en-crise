// =====================================================================
// presence.js — Le bot apparaît « en ligne » sur ton serveur Discord.
//
// Pour stocker les données, de simples requêtes suffisent (api.js). Mais
// pour que le bot s'affiche connecté (pastille verte, « Joue à L'État en
// crise »), il doit garder une connexion ouverte avec Discord : la
// « passerelle » (gateway). Node 22+ sait le faire sans rien installer (WebSocket).
// =====================================================================

import { configDiscord } from './config.js';

const ADRESSE_PASSERELLE = 'wss://gateway.discord.gg/?v=10&encoding=json';
// Codes de fermeture définitifs (jeton invalide...) : inutile de réessayer.
const CODES_FATALS = [4004, 4010, 4011, 4012, 4013, 4014];

export function connecterPresence() {
  const { jetonBot, presence, modeTest } = configDiscord();
  if (!jetonBot || !presence || modeTest || typeof WebSocket === 'undefined') return;

  let tentatives = 0;

  const connecter = () => {
    const socket = new WebSocket(ADRESSE_PASSERELLE);
    let battement = null;
    let sequence = null;
    const envoyer = (donnees) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(donnees));

    socket.addEventListener('message', (evenement) => {
      const message = JSON.parse(evenement.data);
      if (message.s !== null && message.s !== undefined) sequence = message.s;

      if (message.op === 10) {
        // « Hello » : Discord indique à quel rythme envoyer un battement de cœur.
        battement = setInterval(() => envoyer({ op: 1, d: sequence }), message.d.heartbeat_interval);
        // On s'identifie, avec le statut à afficher.
        envoyer({
          op: 2,
          d: {
            token: jetonBot,
            intents: 0, // on n'écoute aucun événement : on veut juste être « en ligne »
            properties: { os: process.platform, browser: 'etat-en-crise', device: 'etat-en-crise' },
            presence: { status: 'online', since: null, afk: false, activities: [{ name: 'L\'État en crise', type: 0 }] },
          },
        });
      } else if (message.op === 1) {
        envoyer({ op: 1, d: sequence }); // Discord demande un battement tout de suite
      } else if (message.t === 'READY') {
        tentatives = 0;
        console.log(`🟢 Bot Discord en ligne : ${message.d.user.username}`);
      }
    });

    socket.addEventListener('close', (evenement) => {
      clearInterval(battement);
      if (CODES_FATALS.includes(evenement.code)) {
        console.warn(`⚠️  Bot Discord refusé par Discord (code ${evenement.code}) : vérifie DISCORD_BOT_TOKEN.`);
        return;
      }
      // Coupure réseau : on se reconnecte, en attendant de plus en plus longtemps (max 1 min).
      tentatives += 1;
      setTimeout(connecter, Math.min(60000, 2000 * 2 ** tentatives));
    });

    socket.addEventListener('error', () => {
      // L'événement « close » suit toujours : la reconnexion se fait là.
    });
  };

  connecter();
}
