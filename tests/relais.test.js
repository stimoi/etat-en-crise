// Test du relais Cloudflare (version GitHub Pages) : « npm test »
// Le relais est une simple fonction fetch(requête) → réponse : on l'appelle
// directement ici, branché sur le faux Discord, comme le ferait le site
// publié sur « https://site.example/depot/ ».

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrerFauxDiscord, JETON_BOT, SALON_RESULTATS, SALON_VOTES, SERVEUR, SECRET_CLIENT,
} from './faux-discord.js';

const SITE = 'https://site.example';
const RELAIS = 'https://relais.example';
let faux;
let relais;
let jeton; // la session, comme le site la garde dans localStorage

// Une requête « venant du site » (en-tête Origin), avec la session si on l'a.
function depuisLeSite(chemin, { methode = 'GET', corps, origine = SITE, session = jeton } = {}) {
  return relais.fetch(new Request(`${RELAIS}${chemin}`, {
    method: methode,
    headers: {
      Origin: origine,
      ...(corps && { 'Content-Type': 'application/json' }),
      ...(session && { Authorization: `Bearer ${session}` }),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  }));
}

before(async () => {
  faux = await demarrerFauxDiscord();
  Object.assign(process.env, {
    CRAFTPICK_API_URL: 'http://localhost:9', // IA volontairement injoignable
    CRAFTPICK_MODELE: 'test',
    DISCORD_URL_BASE: faux.url,
    DISCORD_CLIENT_ID: '123',
    DISCORD_CLIENT_SECRET: SECRET_CLIENT,
    DISCORD_REDIRECT_URI: `${RELAIS}/auth/discord/callback`,
    DISCORD_BOT_TOKEN: JETON_BOT,
    DISCORD_SALON_RESULTATS: SALON_RESULTATS,
    DISCORD_SALON_VOTES: SALON_VOTES,
    DISCORD_SERVEUR_ID: SERVEUR,
    SESSION_SECRET: 'secret-de-test-relais',
    ORIGINE_SITE: SITE,
    DUREE_CACHE_MUR: '15',
  });
  relais = (await import('../relais/worker.js')).default;
});

after(() => faux.fermer());

test('relais : autorise le site (CORS), et lui seul', async () => {
  let reponse = await depuisLeSite('/api/evenement', { methode: 'OPTIONS' });
  assert.equal(reponse.status, 204);
  assert.equal(reponse.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.match(reponse.headers.get('Access-Control-Allow-Headers'), /Authorization/);

  reponse = await depuisLeSite('/api/evenement', { methode: 'OPTIONS', origine: 'https://autre.example' });
  assert.equal(reponse.headers.get('Access-Control-Allow-Origin'), null);
  reponse = await depuisLeSite('/api/evenement', { methode: 'POST', corps: {}, origine: 'https://autre.example' });
  assert.equal(reponse.status, 403);
});

test('relais : le jeu répond même sans IA', async () => {
  const reponse = await depuisLeSite('/api/evenement', { methode: 'POST', corps: { tour: 2, calendrier: { annee: 2026, mois: 9, periode: 1 } } });
  assert.equal(reponse.headers.get('Access-Control-Allow-Origin'), SITE);
  const { evenement, source } = await reponse.json();
  assert.equal(source, 'secours');
  assert.equal(evenement.choix.length, 3);
});

test('relais : connexion Discord, la session revient au site dans « # »', async () => {
  const retour = `${SITE}/depot/?vue=mur#publier`;
  let reponse = await relais.fetch(new Request(`${RELAIS}/auth/discord?retour=${encodeURIComponent(retour)}`));
  assert.equal(reponse.status, 302);
  const cookie = reponse.headers.get('Set-Cookie');
  assert.match(cookie, /^oauth_etat=.*Secure; SameSite=Lax/);

  // Le faux Discord accepte tout de suite et renvoie vers le relais.
  reponse = await fetch(reponse.headers.get('Location'), { redirect: 'manual' });
  const callback = reponse.headers.get('Location');
  assert.ok(callback.startsWith(`${RELAIS}/auth/discord/callback`));

  reponse = await relais.fetch(new Request(callback, { headers: { Cookie: cookie.split(';')[0] } }));
  const destination = reponse.headers.get('Location');
  assert.match(destination, /^https:\/\/site\.example\/depot\/\?vue=mur&bienvenue=1#publier&session=[\w-]+\.[\w-]+$/);
  jeton = destination.split('session=')[1];

  const { joueur } = await (await depuisLeSite('/api/moi')).json();
  assert.equal(joueur.nom, 'Alice');
});

test('relais : ne renvoie jamais vers un autre site après la connexion', async () => {
  const reponse = await relais.fetch(new Request(`${RELAIS}/auth/discord?retour=${encodeURIComponent('https://pirate.example/')}`));
  // Le « retour » est rangé dans le cookie signé : on le relit via la page de Discord.
  const suite = await fetch(reponse.headers.get('Location'), { redirect: 'manual' });
  const fin = await relais.fetch(new Request(suite.headers.get('Location'), { headers: { Cookie: reponse.headers.get('Set-Cookie').split(';')[0] } }));
  assert.ok(fin.headers.get('Location').startsWith(`${SITE}/`));
});

test('relais : publier, voter, commenter avec la session « Bearer »', async () => {
  let reponse = await depuisLeSite('/api/resultats', { methode: 'POST', corps: { titre: 'Relais', resume: 'R', tours: 4, cause: 'ordre', dette: 3650 } });
  assert.equal(reponse.status, 201);
  const { publication } = await reponse.json();
  reponse = await depuisLeSite(`/api/resultats/${publication.id}/vote`, { methode: 'POST', corps: { valeur: -1 } });
  assert.equal((await reponse.json()).dislikes, 1);
  reponse = await depuisLeSite(`/api/resultats/${publication.id}/commentaires`, { methode: 'POST', corps: { texte: 'Vu depuis Pages' } });
  assert.equal(reponse.status, 201);
  const { resultats } = await (await depuisLeSite('/api/resultats')).json();
  assert.equal(resultats[0].monVote, -1);
  assert.equal(resultats[0].nbCommentaires, 1);

  // Sans session : refusé.
  reponse = await depuisLeSite('/api/resultats', { methode: 'POST', corps: { titre: 'X' }, session: null });
  assert.equal(reponse.status, 401);
});

test('relais : discussion (thèmes) et adresse inconnue', async () => {
  const { themes } = await (await depuisLeSite('/api/discussion/themes')).json();
  assert.ok(themes.length > 1);
  assert.equal((await depuisLeSite('/nimporte-quoi')).status, 404);
});
