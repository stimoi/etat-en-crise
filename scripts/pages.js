// =====================================================================
// pages.js — « npm run pages » : fabrique la version GitHub Pages du site.
//
// Résultat : docs/index.html (tout le site dans un seul fichier, comme
// « npm run compiler »), qui connaît l'adresse du relais Cloudflare (RELAIS_URL
// dans .env, écrite par « npm run en-ligne »).
// GitHub Pages publie ensuite le dossier docs/ tel quel.
// À relancer après chaque modification de public/, puis envoyer sur GitHub.
// =====================================================================

import path from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compiler } from './compiler.js';

const RACINE = path.join(import.meta.dirname, '..');
export const DOSSIER_PAGES = path.join(RACINE, 'docs');

// adressePages : l'adresse du site (PAGES_URL). Si c'est un nom de domaine à toi
// (ex. https://etat.avenox.fr/), GitHub Pages le lit dans le fichier docs/CNAME.
export function construirePages(relais, adressePages = process.env.PAGES_URL) {
  const fichier = path.join(DOSSIER_PAGES, 'index.html');
  const resultat = compiler({ relais, fichier });
  // Fichier vide qui dit à GitHub Pages de publier le dossier tel quel (sans « Jekyll »).
  writeFileSync(path.join(DOSSIER_PAGES, '.nojekyll'), '');
  const domaine = adressePages ? new URL(adressePages).hostname : '';
  if (domaine && !domaine.endsWith('.github.io')) writeFileSync(path.join(DOSSIER_PAGES, 'CNAME'), `${domaine}\n`);
  return { ...resultat, fichier };
}

// Lancé directement (« npm run pages »)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cheminEnv = path.join(RACINE, '.env');
  if (existsSync(cheminEnv)) process.loadEnvFile(cheminEnv);
  const relais = process.env.RELAIS_URL;
  if (!relais?.startsWith('https://')) {
    console.error('❌ RELAIS_URL est vide dans .env : lance d\'abord « npm run en-ligne » (ou mettre-en-ligne.bat).');
    process.exit(1);
  }
  const { fichier, taille } = construirePages(relais);
  console.log(`✅ ${path.relative(RACINE, fichier)} (${(taille / 1024).toFixed(0)} Ko), relié au relais ${relais}`);
  console.log('   Envoie maintenant le dossier docs/ sur GitHub (voir README, partie 12).');
}
