// Tests du mur des mandats et des sessions, avec un faux serveur Discord : « npm test »

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  demarrerFauxDiscord, JETON_BOT, SALON_RESULTATS, SALON_VOTES, SERVEUR, SECRET_CLIENT,
} from './faux-discord.js';

let faux;
let mur;
const alice = { id: '111111111111111111', nom: 'Alice', avatar: null };
const bob = { id: '222222222222222222', nom: 'Bob', avatar: null };
const resultat = {
  titre: 'Le mandat des croissants', resume: 'Vous avez subventionné le beurre.', message: '',
  tours: 12, cause: 'dette', dette: 3702.4, periode: 'octobre 2026 → janvier 2027', reformes: ['Santé −90 %'],
};

before(async () => {
  faux = await demarrerFauxDiscord();
  Object.assign(process.env, {
    DISCORD_URL_BASE: faux.url,
    DISCORD_BOT_TOKEN: JETON_BOT,
    DISCORD_SALON_RESULTATS: SALON_RESULTATS,
    DISCORD_SALON_VOTES: SALON_VOTES,
  });
  mur = await import('../discord/mur.js'); // importé APRÈS les réglages
});

after(() => faux.fermer());

test('publier puis relire une publication (données intactes)', async () => {
  const publication = await mur.publier(alice, resultat);
  const [relue] = await mur.listerPublications(alice.id);
  assert.equal(relue.id, publication.id);
  assert.equal(relue.titre, resultat.titre);
  assert.equal(relue.auteur.nom, 'Alice');
  assert.equal(relue.dette, 3702.4);
  assert.deepEqual(relue.reformes, ['Santé −90 %']);
});

test('votes : un vote par joueur, le dernier compte', async () => {
  const [publication] = await mur.listerPublications();
  await mur.voter(alice, publication.id, 1);
  await mur.voter(bob, publication.id, -1);
  let vue = (await mur.listerPublications(bob.id))[0];
  assert.deepEqual([vue.likes, vue.dislikes, vue.monVote], [1, 1, -1]);
  await mur.voter(bob, publication.id, 1); // Bob change d'avis
  vue = (await mur.listerPublications(bob.id))[0];
  assert.deepEqual([vue.likes, vue.dislikes, vue.monVote], [2, 0, 1]);
  await mur.voter(alice, publication.id, 0); // Alice annule
  vue = (await mur.listerPublications(alice.id))[0];
  assert.deepEqual([vue.likes, vue.monVote], [1, 0]);
});

test('commentaires : le premier crée le fil, les suivants s\'y ajoutent', async () => {
  const [publication] = await mur.listerPublications();
  await mur.commenter(alice, publication.id, 'Premier !');
  await mur.commenter(bob, publication.id, 'Moi j\'aurais supprimé la TVA.');
  const commentaires = await mur.listerCommentaires(publication.id);
  assert.deepEqual(commentaires.map((c) => [c.auteur.nom, c.texte]), [['Alice', 'Premier !'], ['Bob', 'Moi j\'aurais supprimé la TVA.']]);
  assert.equal((await mur.listerPublications())[0].nbCommentaires, 2);
});

test('sécurité : un faux vote tapé à la main dans le salon est ignoré', async () => {
  const [publication] = await mur.listerPublications();
  faux.messageHumain(SALON_VOTES, JSON.stringify({ p: publication.id, u: '333333333333333333', v: 1 }));
  faux.messageHumain(SALON_RESULTATS, 'Je suis une fausse publication');
  // Un serveur qui redémarre relit tout depuis Discord : on recharge le module à neuf.
  const murNeuf = await import(`../discord/mur.js?redemarrage=${Date.now()}`);
  const liste = await murNeuf.listerPublications();
  assert.equal(liste.length, 1); // la fausse publication n'apparaît pas
  assert.equal(liste[0].likes, 1); // seulement le vote de Bob, pas celui du tricheur
  assert.equal((await murNeuf.listerCommentaires(liste[0].id)).length, 2); // relus depuis le fil
});

test('publication inconnue : erreur claire', async () => {
  await assert.rejects(mur.voter(alice, '123456789', 1), /introuvable/);
});

test('session : cookie signé valide, modifié ou expiré', async () => {
  const { creerJeton, lireJeton } = await import('../discord/session.js');
  const jeton = creerJeton({ id: '1', nom: 'Alice' }, 'secret', 60);
  assert.equal(lireJeton(jeton, 'secret').nom, 'Alice');
  assert.equal(lireJeton(jeton, 'autre-secret'), null); // mauvais secret
  const [corps, signature] = jeton.split('.');
  const falsifie = Buffer.from(JSON.stringify({ id: '1', nom: 'Pirate', exp: Date.now() + 60000 })).toString('base64url');
  assert.equal(lireJeton(`${falsifie}.${signature}`, 'secret'), null); // contenu modifié
  assert.equal(lireJeton(creerJeton({ id: '1' }, 'secret', -1), 'secret'), null); // expiré
  assert.ok(corps);
});

test('connexion : le joueur est ajouté au serveur Discord (une seule fois)', async () => {
  Object.assign(process.env, { DISCORD_CLIENT_ID: '123', DISCORD_CLIENT_SECRET: SECRET_CLIENT, DISCORD_SERVEUR_ID: SERVEUR });
  const { connecterAvecCode, urlAutorisation } = await import('../discord/oauth.js');
  assert.match(urlAutorisation('etat'), /scope=identify\+guilds\.join/);
  const premiere = await connecterAvecCode('code-alice');
  assert.equal(premiere.joueur.nom, 'Alice');
  assert.equal(premiere.serveur, 'ajoute');
  assert.equal((await connecterAvecCode('code-alice')).serveur, 'deja-membre');

  // Ajout désactivé : on ne demande même plus la permission.
  process.env.DISCORD_AJOUT_AUTO = '0';
  assert.doesNotMatch(urlAutorisation('etat'), /guilds\.join/);
  assert.equal((await connecterAvecCode('code-bob')).serveur, null);
  delete process.env.DISCORD_AJOUT_AUTO;
});
