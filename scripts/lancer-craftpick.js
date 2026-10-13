// =====================================================================
// lancer-craftpick.js — « npm run craftpick »
//
// Lance le jeu avec l'IA de CraftPick (le serveur distant, via son API).
// Les réglages viennent du fichier .env :
//   CRAFTPICK_API_URL   adresse du serveur
//   CRAFTPICK_MODELE    nom du modèle
//   CRAFTPICK_API_KEY   clé, si le serveur en demande une
// Avant de lancer le jeu, le script vérifie que l'API répond.
// =====================================================================

import path from 'node:path';
import { RACINE, serveurRepond, testerModele, lancerJeu } from './outils-lancement.js';

try {
  process.loadEnvFile(path.join(RACINE, '.env'));
} catch {
  console.error('❌ Pas de fichier .env : copie .env.example en .env et remplis la partie CraftPick.');
  process.exit(1);
}

const URL_API = process.env.CRAFTPICK_API_URL;
const MODELE = process.env.CRAFTPICK_MODELE;
const CLE = process.env.CRAFTPICK_API_KEY;

if (!URL_API || !MODELE) {
  console.error('❌ CRAFTPICK_API_URL ou CRAFTPICK_MODELE est vide dans le fichier .env.');
  process.exit(1);
}

console.log('\n🌐 Lancement avec l\'IA CraftPick (API distante)');
// On n'affiche pas l'adresse complète : pratique si tu filmes ton écran.
console.log(`   Modèle : ${MODELE}${CLE ? ' · clé API : oui' : ''}\n`);

console.log('⏳ Vérification de l\'API…');
if (!await serveurRepond(URL_API, 8000)) {
  console.warn('⚠️  L\'API CraftPick ne répond pas pour l\'instant.');
  console.warn('   Le jeu démarre quand même, avec les événements écrits à la main.');
  console.warn('   Astuce : lancer-local.bat (ou « npm run local ») utilise l\'IA installée sur ce PC.\n');
} else {
  const test = await testerModele(URL_API, MODELE, CLE);
  if (test.ok) {
    console.log(`✅ L'API répond (${test.duree} s).\n`);
  } else {
    console.warn(`⚠️  L'API répond, mais pas le modèle : ${test.raison}`);
    console.warn('   Le jeu démarre quand même, avec les événements écrits à la main.\n');
  }
}

// Les réglages du .env sont déjà dans process.env : on les transmet tels quels.
// On ouvre la version « fichier unique » du site, réservée à l'IA CraftPick.
lancerJeu({ NOM_IA: `CraftPick (${MODELE})`, MODE_IA: 'craftpick' }, undefined, { page: '/etat-en-crise.html' });
