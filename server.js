// =====================================================================
// server.js — Le petit serveur du site.
//
// Pourquoi un serveur ? Pour que les secrets (accès à l'IA, bot Discord)
// restent cachés : le navigateur demande au serveur, et c'est le serveur
// (et lui seul) qui parle à l'IA et à Discord.
//
// Il assemble les morceaux du dossier routes/ :
//  - routes/jeu.js        → le jeu (événements, idée libre, bilan) ;
//  - routes/connexion.js  → « Se connecter avec Discord » ;
//  - routes/mur.js        → le mur des mandats (publications, votes, commentaires) ;
//  - routes/discussion.js → la conversation avec l'IA.
// Et il envoie les pages du dossier /public.
// =====================================================================

import path from 'node:path';
import express from 'express';
import { routesJeu } from './routes/jeu.js';
import { routesConnexion } from './routes/connexion.js';
import { routesMur } from './routes/mur.js';
import { routesDiscussion } from './routes/discussion.js';
import { stockageConfigure, reglagesManquants } from './discord/config.js';
import { initialiserMur } from './discord/mur.js';
import { connecterPresence } from './discord/presence.js';
import { compiler } from './scripts/compiler.js';

// Charge le fichier .env dans process.env. C'est une fonction intégrée à Node
// (version 20.12 et plus) : pas besoin d'installer le paquet "dotenv".
// Les réglages déjà fournis au lancement (par lancer-local.bat...) restent prioritaires.
try {
  process.loadEnvFile(path.join(import.meta.dirname, '.env'));
} catch {
  console.warn('⚠️  Pas de fichier .env trouvé : le jeu utilisera uniquement les événements écrits à la main.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Lit le JSON envoyé par le navigateur. La limite évite qu'on nous envoie un
// énorme fichier (le journal de fin de partie reste bien en dessous).
app.use(express.json({ limit: '50kb' }));

app.use(routesJeu);
app.use(routesConnexion);
app.use(routesMur);
app.use(routesDiscussion);

// Sert les pages (index.html, resultats.html, discussion.html...) depuis /public.
app.use(express.static(path.join(import.meta.dirname, 'public')));

// La version « fichier unique » du site (dist/etat-en-crise.html) est RÉSERVÉE
// à l'IA CraftPick (lancer-craftpick.bat ou npm start). Elle est recompilée à
// chaque démarrage à partir de public/ : elle est toujours à jour.
// Avec l'IA locale (lancer-local.bat, MODE_IA=local), elle n'est pas servie.
const fichierUniqueActif = process.env.MODE_IA !== 'local';
if (fichierUniqueActif) {
  try {
    compiler();
  } catch (erreur) {
    console.warn(`⚠️  Fichier unique non compilé : ${erreur.message}`);
  }
  app.use(express.static(path.join(import.meta.dirname, 'dist')));
} else {
  app.get('/etat-en-crise.html', (req, res) => {
    res.status(403).type('text/plain; charset=utf-8')
      .send(`La version « fichier unique » est réservée à l'IA CraftPick : lance lancer-craftpick.bat. (Avec l'IA locale, utilise http://localhost:${PORT}/)`);
  });
}

app.listen(PORT, () => {
  // NOM_IA est donné par « npm run local » ou « npm run craftpick » ; sinon, le modèle du .env.
  const ia = process.env.NOM_IA || process.env.CRAFTPICK_MODELE || 'aucune (événements écrits à la main)';
  console.log(`🤖 IA utilisée : ${ia}`);

  if (stockageConfigure()) {
    // On relit le mur depuis Discord dès le démarrage, pour que la page s'affiche vite.
    initialiserMur().catch((erreur) => console.warn(`⚠️  Mur des mandats : lecture Discord impossible (${erreur.message}).`));
    connecterPresence();
  } else {
    console.log(`ℹ️  Mur des mandats désactivé : réglages Discord manquants (${reglagesManquants().join(', ')}).`);
  }

  console.log(`✅ Site lancé : ouvre http://localhost:${PORT} dans ton navigateur (Ctrl+C pour arrêter)`);
  if (fichierUniqueActif) console.log(`📦 Version fichier unique (CraftPick) : http://localhost:${PORT}/etat-en-crise.html`);
});
