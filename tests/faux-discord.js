// =====================================================================
// faux-discord.js — Un FAUX serveur Discord, pour les tests.
//
// Il imite les quelques routes de l'API Discord utilisées par le mur des
// mandats (connexion OAuth, bot, messages, fils), avec des données en
// mémoire. Ça permet de tester tout le mur sans vrais identifiants.
// =====================================================================

import http from 'node:http';

export const BOT = { id: '900000000000000001', username: 'BotEtatEnCrise', bot: true };
export const JETON_BOT = 'jeton-bot-test';
export const SECRET_CLIENT = 'secret-test';
export const SALON_RESULTATS = '100';
export const SALON_VOTES = '200';
export const SERVEUR = '500';

const JOUEURS = {
  'jeton-alice': { id: '111111111111111111', username: 'alice', global_name: 'Alice', avatar: null },
  'jeton-bob': { id: '222222222222222222', username: 'bob', global_name: 'Bob', avatar: null },
};

export function demarrerFauxDiscord(port = 0) {
  const salons = new Map([[SALON_RESULTATS, []], [SALON_VOTES, []]]);
  const messagesParId = new Map();
  let compteur = 1000n;
  let connexions = 0;
  const membres = new Set(); // membres du faux serveur Discord
  const nouvelId = () => String(1300000000000000000n + (compteur += 1n));

  const ajouterMessage = (salonId, auteur, donnees) => {
    const message = {
      id: nouvelId(), channel_id: salonId, type: 0, author: auteur,
      content: donnees.content ?? '', embeds: donnees.embeds ?? [], timestamp: new Date().toISOString(),
    };
    salons.get(salonId).push(message);
    messagesParId.set(message.id, message);
    const parent = messagesParId.get(salonId);
    if (parent?.thread) parent.thread.message_count += 1;
    return message;
  };

  const repondre = (res, statut, corps) => {
    res.writeHead(statut, { 'Content-Type': 'application/json' });
    res.end(corps === undefined ? '' : JSON.stringify(corps));
  };

  const serveur = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let corps = '';
    for await (const morceau of req) corps += morceau;
    const auth = req.headers.authorization ?? '';

    // Page d'autorisation : accepte tout de suite (Alice, puis Bob, puis Alice...).
    if (url.pathname === '/oauth2/authorize') {
      connexions += 1;
      const retour = new URL(url.searchParams.get('redirect_uri'));
      retour.searchParams.set('code', connexions % 2 ? 'code-alice' : 'code-bob');
      retour.searchParams.set('state', url.searchParams.get('state'));
      res.writeHead(302, { Location: retour.toString() });
      return res.end();
    }
    if (url.pathname === '/api/v10/oauth2/token') {
      const champs = new URLSearchParams(corps);
      if (champs.get('client_secret') !== SECRET_CLIENT) return repondre(res, 401, { message: 'invalid_client' });
      const jeton = { 'code-alice': 'jeton-alice', 'code-bob': 'jeton-bob' }[champs.get('code')];
      return jeton ? repondre(res, 200, { access_token: jeton, scope: 'identify guilds.join' }) : repondre(res, 400, { message: 'invalid_grant' });
    }
    if (url.pathname === '/api/v10/users/@me') {
      if (auth === `Bot ${JETON_BOT}`) return repondre(res, 200, BOT);
      const joueur = JOUEURS[auth.replace('Bearer ', '')];
      return joueur ? repondre(res, 200, joueur) : repondre(res, 401, { message: '401: Unauthorized', code: 0 });
    }
    if (auth !== `Bot ${JETON_BOT}`) return repondre(res, 401, { message: '401: Unauthorized', code: 0 });

    // Ajout d'un joueur au serveur : 201 la première fois, 204 s'il y est déjà.
    let m = url.pathname.match(/^\/api\/v10\/guilds\/(\d+)\/members\/(\d+)$/);
    if (m && req.method === 'PUT') {
      if (m[1] !== SERVEUR) return repondre(res, 404, { message: 'Unknown Guild', code: 10004 });
      const jetonJoueur = JSON.parse(corps).access_token;
      if (JOUEURS[jetonJoueur]?.id !== m[2]) return repondre(res, 403, { message: 'Invalid OAuth2 access token', code: 50025 });
      if (membres.has(m[2])) return repondre(res, 204);
      membres.add(m[2]);
      return repondre(res, 201, { user: JOUEURS[jetonJoueur] });
    }
    m = url.pathname.match(/^\/api\/v10\/guilds\/(\d+)$/);
    if (m) return m[1] === SERVEUR ? repondre(res, 200, { id: SERVEUR, name: 'Serveur du jeu' }) : repondre(res, 404, { message: 'Unknown Guild', code: 10004 });

    m = url.pathname.match(/^\/api\/v10\/channels\/(\d+)\/messages$/);
    if (m) {
      if (!salons.has(m[1])) return repondre(res, 404, { message: 'Unknown Channel', code: 10003 });
      if (req.method === 'GET') {
        const avant = url.searchParams.get('before');
        let liste = [...salons.get(m[1])].reverse(); // le plus récent d'abord, comme Discord
        if (avant) liste = liste.filter((x) => BigInt(x.id) < BigInt(avant));
        return repondre(res, 200, liste.slice(0, Number(url.searchParams.get('limit') ?? 50)));
      }
      return repondre(res, 200, ajouterMessage(m[1], BOT, JSON.parse(corps)));
    }
    m = url.pathname.match(/^\/api\/v10\/channels\/(\d+)\/messages\/(\d+)\/threads$/);
    if (m && req.method === 'POST') {
      const message = messagesParId.get(m[2]);
      if (!message) return repondre(res, 404, { message: 'Unknown Message', code: 10008 });
      if (message.thread) return repondre(res, 400, { message: 'Thread already exists', code: 160004 });
      message.thread = { id: m[2], message_count: 0 };
      salons.set(m[2], []);
      return repondre(res, 201, { id: m[2], type: 11 });
    }
    m = url.pathname.match(/^\/api\/v10\/channels\/(\d+)$/);
    if (m) return salons.has(m[1]) ? repondre(res, 200, { id: m[1], name: `salon-${m[1]}`, type: 0 }) : repondre(res, 404, { message: 'Unknown Channel', code: 10003 });

    repondre(res, 404, { message: 'Route inconnue du faux Discord', code: 0 });
  });

  return new Promise((resoudre) => {
    serveur.listen(port, () => resoudre({
      url: `http://localhost:${serveur.address().port}`,
      fermer: () => new Promise((fin) => serveur.close(fin)),
      // Pour les tests : un membre du serveur écrit un message à la main.
      messageHumain: (salonId, contenu) => ajouterMessage(salonId, { id: '333333333333333333', username: 'tricheur' }, { content: contenu }),
    }));
  });
}
