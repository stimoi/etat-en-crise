// Test de bout en bout du serveur Node (Express) : « npm test »
// On lance le VRAI server.js, branché sur le faux Discord, et on rejoue le
// parcours d'un joueur : connexion, publication, vote, commentaire...
// (L'IA n'est pas appelée : le jeu utilise alors ses événements de secours.)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  demarrerFauxDiscord, JETON_BOT, SALON_RESULTATS, SALON_VOTES, SERVEUR, SECRET_CLIENT,
} from './faux-discord.js';

const PORT = 3990;
const SITE = `http://localhost:${PORT}`;
let faux;
let serveur;
let cookies = '';

// Un petit « navigateur » : garde les cookies et ne suit pas les redirections.
async function demander(chemin, options = {}) {
  const reponse = await fetch(chemin.startsWith('http') ? chemin : `${SITE}${chemin}`, {
    redirect: 'manual',
    ...options,
    headers: { cookie: cookies, ...(options.corps && { 'Content-Type': 'application/json' }), ...options.headers },
    body: options.corps ? JSON.stringify(options.corps) : undefined,
  });
  for (const cookie of reponse.headers.getSetCookie()) {
    const [paire] = cookie.split(';');
    const [nom] = paire.split('=');
    cookies = [...cookies.split('; ').filter((c) => c && !c.startsWith(`${nom}=`)), paire].join('; ');
  }
  return reponse;
}

before(async () => {
  faux = await demarrerFauxDiscord();
  serveur = spawn(process.execPath, ['server.js'], {
    cwd: path.join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      MODE_IA: 'local', // pas de compilation du fichier unique pendant les tests
      CRAFTPICK_API_URL: 'http://localhost:9', // IA volontairement injoignable
      CRAFTPICK_MODELE: 'test',
      DISCORD_URL_BASE: faux.url,
      DISCORD_CLIENT_ID: '123',
      DISCORD_CLIENT_SECRET: SECRET_CLIENT,
      DISCORD_REDIRECT_URI: `${SITE}/auth/discord/callback`,
      DISCORD_BOT_TOKEN: JETON_BOT,
      DISCORD_SALON_RESULTATS: SALON_RESULTATS,
      DISCORD_SALON_VOTES: SALON_VOTES,
      DISCORD_SERVEUR_ID: SERVEUR,
      SESSION_SECRET: 'secret-de-test',
      ORIGINE_SITE: '',
    },
    stdio: 'ignore',
  });
  for (let essai = 0; essai < 50; essai += 1) {
    try {
      await fetch(`${SITE}/api/moi`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});

after(async () => {
  serveur.kill();
  await faux.fermer();
});

test('serveur : le jeu répond même sans IA (événement de secours)', async () => {
  // En milieu de mois (periode 1) : pas de rendez-vous du calendrier, donc l'IA est sollicitée.
  const reponse = await demander('/api/evenement', { method: 'POST', corps: { tour: 2, calendrier: { annee: 2026, mois: 9, periode: 1 } } });
  const { evenement, source } = await reponse.json();
  assert.equal(source, 'secours');
  assert.equal(evenement.choix.length, 3);
});

test('serveur : connexion Discord complète (cookie de session)', async () => {
  let reponse = await demander('/auth/discord?retour=%2Fresultats.html%23publier');
  assert.equal(reponse.status, 302);
  reponse = await demander(reponse.headers.get('location')); // le faux Discord accepte
  reponse = await demander(reponse.headers.get('location')); // retour sur le site
  assert.equal(reponse.headers.get('location'), '/resultats.html?bienvenue=1#publier');
  const { joueur } = await (await demander('/api/moi')).json();
  assert.equal(joueur.nom, 'Alice');
});

test('serveur : publier, voter, commenter', async () => {
  let reponse = await demander('/api/resultats', { method: 'POST', corps: { titre: 'Test', resume: 'R', tours: 3, cause: 'dette', dette: 3700 } });
  assert.equal(reponse.status, 201);
  const { publication } = await reponse.json();
  reponse = await demander(`/api/resultats/${publication.id}/vote`, { method: 'POST', corps: { valeur: 1 } });
  assert.equal((await reponse.json()).likes, 1);
  reponse = await demander(`/api/resultats/${publication.id}/commentaires`, { method: 'POST', corps: { texte: 'Bravo' } });
  assert.equal(reponse.status, 201);
  const { resultats } = await (await demander('/api/resultats')).json();
  assert.equal(resultats[0].nbCommentaires, 1);
  assert.equal(resultats[0].monVote, 1);
});

test('serveur : refuse une requête venant d\'un autre site', async () => {
  const reponse = await demander('/api/resultats', { method: 'POST', corps: {}, headers: { Origin: 'https://site-malveillant.com' } });
  assert.equal(reponse.status, 403);
});
