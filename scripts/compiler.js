// =====================================================================
// compiler.js — « npm run compiler » : tout le site dans UN seul fichier HTML.
//
// Fabrique dist/etat-en-crise.html à partir des fichiers de public/,
// SANS les modifier :
//  - les 3 pages (jeu, mur des mandats, discussion) ;
//  - la feuille de style ;
//  - tous les modules JavaScript.
//
// Comment ça marche, une fois dans le navigateur :
//  - l'adresse choisit la page : etat-en-crise.html?vue=jouer | mur | discussion ;
//  - les modules JavaScript sont rangés une seule fois dans le fichier, avec
//    une « carte des imports » (import map) qui permet de les retrouver comme
//    si c'étaient de vrais fichiers (« etat/regles.js ») ;
//  - un petit script de démarrage met en place la page demandée, puis lance
//    son module principal (game.js, resultats.js ou discussion.js).
// Chaque page tourne donc exactement comme avant.
//
// Deux usages :
//  - servi par le serveur du jeu (http://localhost:3000/etat-en-crise.html) :
//    c'est lui qui garde les secrets et parle à l'IA et à Discord. Le serveur
//    relance cette compilation à chaque démarrage : le fichier est toujours à jour ;
//  - publié sur GitHub Pages (« npm run pages » → docs/index.html) : la page
//    connaît alors l'adresse du relais Cloudflare (window.API_RELAIS), qui
//    joue le rôle du serveur.
// =====================================================================

import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(import.meta.dirname, '..');
const PUBLIC = path.join(RACINE, 'public');
export const FICHIER_COMPILE = path.join(RACINE, 'dist', 'etat-en-crise.html');

// Les pages du site et leur nom dans l'adresse (?vue=...).
const PAGES = { jouer: 'index.html', mur: 'resultats.html', discussion: 'discussion.html' };
const VUE_DE_FICHIER = Object.fromEntries(Object.entries(PAGES).map(([vue, fichier]) => [fichier, vue]));

const lire = (fichier) => readFileSync(path.join(PUBLIC, fichier), 'utf8');

// Cherche un morceau obligatoire, et s'arrête net s'il est introuvable :
// mieux vaut une compilation qui échoue qu'un fichier silencieusement cassé.
function extraireObligatoire(texte, motif, ou) {
  const resultat = texte.match(motif);
  if (!resultat) throw new Error(`Compilation impossible : ${motif} introuvable dans ${ou}`);
  return resultat;
}

// « resultats.html#publier » → « ?vue=mur#publier » (liens entre pages).
function lienVersVue(fichier, suite = '') {
  const vue = VUE_DE_FICHIER[fichier];
  return `?vue=${vue}${suite.startsWith('?') ? `&${suite.slice(1)}` : suite}`;
}

// --- Modules JavaScript ----------------------------------------------
// « import ... from './regles.js' » → « from 'etat/regles.js' » : un nom que
// la carte des imports sait retrouver. Les liens entre pages sont aussi adaptés.
function preparerModule(fichier) {
  let code = lire(fichier);
  code = code.replace(/from '\.\/([\w-]+\.js)'/g, 'from \'etat/$1\'');
  code = code.replace(/import '\.\/([\w-]+\.js)'/g, 'import \'etat/$1\'');
  // Adresses de pages écrites dans le code : 'resultats.html#publier', '/resultats.html'...
  code = code.replace(/(['"`])(\/?)(index|resultats|discussion)\.html([?#][^'"`]*)?\1/g, (tout, guillemet, barre, nom, suite = '') => {
    const lien = lienVersVue(`${nom}.html`, suite);
    // Avec une barre au début, c'est une adresse complète (retour après connexion Discord).
    return barre ? `location.pathname + '${lien}'` : `'${lien}'`;
  });
  if (/['"`]\/?[\w-]+\.html/.test(code)) {
    throw new Error(`Compilation impossible : une adresse de page n'a pas été convertie dans ${fichier}`);
  }
  return code;
}

// --- Pages HTML --------------------------------------------------------
// De chaque page, on garde : son titre, le contenu de <body> et le nom de
// son module principal. L'en-tête (style, polices) est commun aux 3 pages.
function preparerPage(fichier) {
  const html = lire(fichier);
  const titre = extraireObligatoire(html, /<title>([^<]*)<\/title>/, fichier)[1];
  let corps = extraireObligatoire(html, /<body>([\s\S]*)<\/body>/, fichier)[1];
  const module = extraireObligatoire(corps, /<script type="module" src="([\w-]+\.js)"><\/script>/, fichier)[1];
  corps = corps.replace(/\s*<!-- type="module"[^>]*-->/, '').replace(/<script type="module" src="[\w-]+\.js"><\/script>/, '');

  // Liens entre pages : href="resultats.html" → href="?vue=mur"
  corps = corps.replace(/href="(index|resultats|discussion)\.html([?#][^"]*)?"/g,
    (tout, nom, suite = '') => `href="${lienVersVue(`${nom}.html`, suite)}"`);
  if (/<script|(href|src)="(?!https?:|\?|#)[^"]+"/.test(corps)) {
    throw new Error(`Compilation impossible : un script ou un fichier local reste dans ${fichier}`);
  }
  return { titre, corps, module: `etat/${module}` };
}

// L'en-tête commun : on le reprend de la page du jeu (polices Google),
// sans la feuille de style ni les préchargements (tout est déjà dans le fichier).
function enTeteCommun() {
  return extraireObligatoire(lire('index.html'), /<head>([\s\S]*)<\/head>/, 'index.html')[1]
    .replace(/\s*<title>[^<]*<\/title>/, '')
    .replace(/\s*<link rel="stylesheet" href="style\.css">/, '')
    .replace(/\s*<!--[\s\S]*?-->/g, '')
    .replace(/\s*<link rel="modulepreload" href="[^"]+">/g, '')
    .trim();
}

// Pour glisser un texte dans un <script> sans le casser : « </script> » ou « <!-- »
// à l'intérieur fermeraient le script trop tôt.
const enJs = (valeur) => JSON.stringify(valeur).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

// options.relais : adresse du relais (version GitHub Pages), vide pour le serveur Node.
// options.fichier : où écrire le résultat.
export function compiler({ relais = '', fichier = FICHIER_COMPILE } = {}) {
  const imports = Object.fromEntries(readdirSync(PUBLIC)
    .filter((fichier) => fichier.endsWith('.js'))
    .map((fichier) => [`etat/${fichier}`, `data:text/javascript;base64,${Buffer.from(preparerModule(fichier), 'utf8').toString('base64')}`]));
  const pages = Object.fromEntries(Object.entries(PAGES).map(([vue, fichier]) => [vue, preparerPage(fichier)]));
  const css = lire('style.css');
  if (css.includes('</style')) throw new Error('Compilation impossible : « </style » dans style.css');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <!--
${relais ? `    Version GitHub Pages : fichier GÉNÉRÉ par « npm run pages » à partir du dossier public/.
    L'IA, le mur et la connexion Discord passent par le relais : ${relais}` : `    Version « fichier unique », réservée à l'IA CraftPick (lancer-craftpick.bat).
    Fichier GÉNÉRÉ par « npm run compiler » (et à chaque démarrage du serveur).
    À ouvrir via le serveur du jeu : http://localhost:3000/etat-en-crise.html`}
    Ne pas le modifier à la main : modifie public/, puis recompile.
  -->
  ${enTeteCommun()}
  <title>L'État en crise</title>${relais ? `
  <!-- Le « serveur » de cette version : le relais Cloudflare (voir public/serveur.js). -->
  <script>window.API_RELAIS = ${enJs(relais)};</script>` : ''}
  <!-- Carte des imports : « etat/regles.js » → le code du module, embarqué ici. -->
  <script type="importmap">${enJs({ imports })}</script>
  <style>
${css}
  </style>
</head>
<body>
<noscript>Ce jeu a besoin de JavaScript.</noscript>
<script>
  // Les 3 pages du site : titre, contenu, module principal.
  const PAGES = ${enJs(pages)};

  // La page demandée par l'adresse (?vue=jouer | mur | discussion). Par défaut : le jeu.
  const page = PAGES[new URLSearchParams(location.search).get('vue')] || PAGES.jouer;

  document.addEventListener('DOMContentLoaded', () => {
    document.title = page.titre;
    document.body.innerHTML = page.corps;
    // Le module principal de la page (créé ainsi, le navigateur l'exécute).
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = "import '" + page.module + "';";
    document.body.append(script);
  });
</script>
</body>
</html>
`;

  mkdirSync(path.dirname(fichier), { recursive: true });
  writeFileSync(fichier, html);
  return { taille: Buffer.byteLength(html), modules: Object.keys(imports).length, pages: Object.keys(pages).length };
}

// Lancé directement (« npm run compiler ») : on compile et on affiche un résumé.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { taille, modules, pages } = compiler();
  console.log(`✅ ${path.relative(RACINE, FICHIER_COMPILE)} : ${pages} pages, ${modules} modules JavaScript, ${(taille / 1024).toFixed(0)} Ko.`);
  console.log('   À ouvrir via le serveur : http://localhost:3000/etat-en-crise.html');
}
