// =====================================================================
// en-ligne.js — « npm run en-ligne » (ou mettre-en-ligne.bat).
// Met le jeu en ligne SANS ton PC : site sur GitHub Pages + relais Cloudflare.
//
// Étapes :
//  1. vérifie les réglages du .env (IA, Discord) ;
//  2. demande l'adresse du site GitHub Pages (une seule fois, gardée dans .env) ;
//  3. connexion à Cloudflare (une fenêtre du navigateur s'ouvre la 1re fois) ;
//  4. envoie le relais (relais/worker.js) chez Cloudflare ;
//  5. lui confie les réglages, CHIFFRÉS (jeton du bot, secrets...) : ils ne
//     sont jamais écrits dans le site ni sur GitHub ;
//  6. fabrique docs/index.html (« npm run pages »), à envoyer sur GitHub.
//
// L'outil de Cloudflare (« wrangler ») est téléchargé automatiquement par npx :
// ce n'est pas une dépendance du jeu.
// =====================================================================

import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { construirePages } from './pages.js';

const RACINE = path.join(import.meta.dirname, '..');
const CHEMIN_ENV = path.join(RACINE, '.env');
const WRANGLER = 'npx --yes wrangler@4';

const OBLIGATOIRES = [
  'CRAFTPICK_API_URL', 'CRAFTPICK_MODELE',
  'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN',
  'DISCORD_SALON_RESULTATS', 'DISCORD_SALON_VOTES', 'SESSION_SECRET',
];
// Réglages confiés au relais (en plus de ORIGINE_SITE et DISCORD_REDIRECT_URI, calculés ici).
const CONFIES_AU_RELAIS = [...OBLIGATOIRES, 'CRAFTPICK_API_KEY', 'DISCORD_SERVEUR_ID', 'DISCORD_AJOUT_AUTO'];

// Écrit (ou remplace) une ligne « NOM=valeur » dans .env.
function reglerDansEnv(nom, valeur) {
  const contenu = existsSync(CHEMIN_ENV) ? readFileSync(CHEMIN_ENV, 'utf8') : '';
  const ligne = `${nom}=${valeur}`;
  const motif = new RegExp(`^${nom}=.*$`, 'm');
  writeFileSync(CHEMIN_ENV, motif.test(contenu) ? contenu.replace(motif, ligne) : `${contenu.replace(/\n?$/, '\n')}${ligne}\n`);
  process.env[nom] = valeur;
}

// Cloudflare refuse d'appeler une adresse IP brute (« http://82.26.80.20:11434 »).
// sslip.io est un service gratuit où « 82-26-80-20.sslip.io » renvoie vers 82.26.80.20.
function adresseJoignableDepuisCloudflare(adresse) {
  const url = new URL(adresse);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) url.hostname = `${url.hostname.replaceAll('.', '-')}.sslip.io`;
  return url.toString().replace(/\/$/, '');
}

// Lance wrangler, affiche ce qu'il dit, et renvoie son texte.
// « entree » : texte envoyé à wrangler (les secrets passent ainsi, sans fichier sur le disque).
function wrangler(commande, entree) {
  return new Promise((resoudre) => {
    const processus = spawn(`${WRANGLER} ${commande}`, {
      cwd: RACINE,
      shell: true,
      stdio: [entree === undefined ? 'inherit' : 'pipe', 'pipe', 'inherit'],
    });
    let sortie = '';
    processus.stdout.on('data', (morceau) => {
      sortie += morceau;
      process.stdout.write(morceau);
    });
    if (entree !== undefined) processus.stdin.end(entree);
    processus.on('close', (code) => resoudre({ code, sortie }));
  });
}

function arreter(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

async function demanderAdressePages() {
  const actuelle = process.env.PAGES_URL;
  if (actuelle?.startsWith('https://')) return actuelle;
  console.log('Adresse de ton site GitHub Pages ?');
  console.log('  Forme : https://TON-PSEUDO-GITHUB.github.io/NOM-DU-DEPOT/');
  console.log('  (ex. pseudo « marie42 » et dépôt « etat-en-crise » → https://marie42.github.io/etat-en-crise/)');
  const questions = readline.createInterface({ input: process.stdin, output: process.stdout });
  const reponse = (await questions.question('> ')).trim();
  questions.close();
  let adresse;
  try {
    adresse = new URL(reponse);
  } catch {
    arreter('Adresse illisible. Relance et colle l\'adresse complète (https://...).');
  }
  if (adresse.protocol !== 'https:') arreter('L\'adresse doit commencer par https://');
  const propre = adresse.href.endsWith('/') ? adresse.href : `${adresse.href}/`;
  reglerDansEnv('PAGES_URL', propre);
  return propre;
}

async function main() {
  console.log('🌍 Mise en ligne : site sur GitHub Pages + relais Cloudflare\n');

  // 1. Réglages
  if (!existsSync(CHEMIN_ENV)) arreter('Fichier .env introuvable : lance d\'abord lancer-craftpick.bat ou configurer-discord.bat.');
  process.loadEnvFile(CHEMIN_ENV);
  const manquants = OBLIGATOIRES.filter((nom) => !process.env[nom]);
  if (manquants.length) arreter(`Réglages vides dans .env : ${manquants.join(', ')}.\n   Lance configurer-discord.bat pour t'aider.`);

  // 2. Adresse du site
  const adressePages = await demanderAdressePages();
  const origineSite = new URL(adressePages).origin;

  // 3. Connexion à Cloudflare
  console.log('\n🔑 Connexion à Cloudflare...');
  const { sortie: qui } = await wrangler('whoami');
  if (/not authenticated|non authentifi/i.test(qui)) {
    console.log('Une page Cloudflare va s\'ouvrir : connecte-toi (compte gratuit) puis clique « Allow ».');
    const { code } = await wrangler('login');
    if (code !== 0) arreter('Connexion à Cloudflare échouée.');
  }

  // 4. Envoi du relais
  console.log('\n🚀 Envoi du relais chez Cloudflare...');
  const envoi = await wrangler('deploy');
  const relais = envoi.sortie.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];
  if (envoi.code !== 0 || !relais) arreter('L\'envoi du relais a échoué (message de Cloudflare ci-dessus).');

  // 5. Réglages du relais, envoyés chiffrés
  console.log('\n🔒 Envoi des réglages (chiffrés) au relais...');
  const reglages = Object.fromEntries(CONFIES_AU_RELAIS
    .filter((nom) => process.env[nom])
    .map((nom) => [nom, process.env[nom]]));
  reglages.CRAFTPICK_API_URL = adresseJoignableDepuisCloudflare(reglages.CRAFTPICK_API_URL);
  reglages.ORIGINE_SITE = origineSite;
  reglages.DISCORD_REDIRECT_URI = `${relais}/auth/discord/callback`;
  const { code } = await wrangler('secret bulk', JSON.stringify(reglages));
  if (code !== 0) arreter('L\'envoi des réglages a échoué (message de Cloudflare ci-dessus).');
  reglerDansEnv('RELAIS_URL', relais);

  // 6. Le site
  const { fichier } = construirePages(relais);

  console.log(`
✅ Relais en ligne : ${relais}
✅ Site fabriqué    : ${path.relative(RACINE, fichier)}

👉 Il reste 2 choses à faire à la main (voir README, partie 12) :
   1. Discord Developer Portal → ton application → OAuth2 → Redirects → ajoute :
        ${reglages.DISCORD_REDIRECT_URI}
   2. Envoie le projet sur GitHub, puis Settings → Pages → « Deploy from a branch »,
      branche main, dossier /docs. Le site sera ici : ${adressePages}
`);
}

main();
