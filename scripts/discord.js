// =====================================================================
// discord.js — « npm run discord » : l'assistant de configuration Discord.
//
// Il vérifie, étape par étape, tout ce dont le mur des mandats a besoin :
//  - les réglages du fichier .env ;
//  - le jeton du bot (en demandant à Discord qui il est) ;
//  - l'accès du bot aux deux salons ;
// et affiche le lien pour inviter le bot sur ton serveur, avec les bonnes permissions.
// Il n'affiche JAMAIS les secrets eux-mêmes.
// =====================================================================

import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { RACINE } from './outils-lancement.js';
import { configDiscord, reglagesManquants } from '../discord/config.js';
import { appelBot } from '../discord/api.js';

const cheminEnv = path.join(RACINE, '.env');
try {
  process.loadEnvFile(cheminEnv);
} catch {
  console.error('❌ Pas de fichier .env : copie .env.example en .env, puis relance.');
  process.exit(1);
}

// Permissions dont le bot a besoin, additionnées (chaque permission est un « bit ») :
// créer une invitation (pour ajouter les joueurs au serveur), voir les salons, envoyer
// des messages, intégrer des liens (cartes), lire l'historique, créer des fils publics,
// écrire dans les fils.
const PERMISSIONS = (1n << 0n) | (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 16n) | (1n << 35n) | (1n << 38n);

let problemes = 0;
const ok = (texte) => console.log(`  ✅ ${texte}`);
const ko = (texte) => {
  console.log(`  ❌ ${texte}`);
  problemes += 1;
};

console.log('\n🔧 Assistant de configuration Discord\n');

// 1. Secret de session : on le crée s'il manque (il ne sert qu'à ce serveur).
if (!process.env.SESSION_SECRET) {
  const secret = crypto.randomBytes(32).toString('hex');
  const contenu = readFileSync(cheminEnv, 'utf8');
  writeFileSync(cheminEnv, /^SESSION_SECRET=.*$/m.test(contenu)
    ? contenu.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`)
    : `${contenu.trimEnd()}\nSESSION_SECRET=${secret}\n`);
  process.env.SESSION_SECRET = secret;
  ok('SESSION_SECRET créé automatiquement dans .env');
}

const config = configDiscord();
const manquants = reglagesManquants();
console.log('1. Réglages du fichier .env');
if (manquants.length) ko(`À remplir : ${manquants.join(', ')}`);
else ok('Tous les réglages sont remplis');

// 2. Connexion des joueurs
console.log('\n2. Connexion des joueurs (OAuth2)');
if (config.clientId) {
  ok(`Application : ${config.clientId}`);
  console.log(`  👉 Dans le portail Discord > OAuth2 > Redirects, ajoute exactement :\n     ${config.redirection}`);
} else {
  ko('DISCORD_CLIENT_ID est vide');
}

// 3. Le bot
console.log('\n3. Le bot');
let bot = null;
if (config.jetonBot) {
  try {
    bot = await appelBot('GET', '/users/@me');
    ok(`Jeton valide : le bot s'appelle « ${bot.username} »`);
  } catch (erreur) {
    ko(`Jeton refusé par Discord (${erreur.message})`);
  }
} else {
  ko('DISCORD_BOT_TOKEN est vide');
}
const idApplication = config.clientId || bot?.id;
if (idApplication) {
  console.log('  👉 Lien pour inviter le bot sur ton serveur (à ouvrir dans le navigateur) :');
  console.log(`     https://discord.com/oauth2/authorize?client_id=${idApplication}&scope=bot&permissions=${PERMISSIONS}`);
}

// 4. Les salons
console.log('\n4. Les salons');
for (const [nom, id] of [['DISCORD_SALON_RESULTATS', config.salonResultats], ['DISCORD_SALON_VOTES', config.salonVotes]]) {
  if (!id) {
    ko(`${nom} est vide`);
    continue;
  }
  if (!bot) {
    console.log(`  ⏭️  ${nom} : vérifiable une fois le bot valide`);
    continue;
  }
  try {
    const salon = await appelBot('GET', `/channels/${id}`);
    await appelBot('GET', `/channels/${id}/messages?limit=1`); // le bot peut-il lire l'historique ?
    if (salon.type !== 0) ko(`${nom} : « #${salon.name} » doit être un salon TEXTUEL classique`);
    else ok(`${nom} : #${salon.name} (le bot y a accès)`);
  } catch (erreur) {
    ko(`${nom} : accès impossible (${erreur.codeDiscord === 50001 ? 'le bot n\'a pas accès à ce salon : invite-le ou donne-lui les droits' : erreur.message})`);
  }
}

// 5. Ajout automatique des joueurs au serveur (facultatif)
console.log('\n5. Ajout automatique des joueurs au serveur Discord');
if (!config.serveurId) {
  console.log('  ⏭️  Désactivé (DISCORD_SERVEUR_ID vide). Facultatif : remplis-le pour que la connexion ajoute les joueurs au serveur.');
} else if (process.env.DISCORD_AJOUT_AUTO === '0') {
  console.log('  ⏭️  Désactivé (DISCORD_AJOUT_AUTO=0).');
} else if (bot) {
  try {
    const serveur = await appelBot('GET', `/guilds/${config.serveurId}`);
    ok(`Serveur « ${serveur.name} » : les joueurs connectés y seront ajoutés`);
    console.log('  👉 Le bot doit avoir la permission « Créer une invitation » sur ce serveur (incluse dans le lien ci-dessus).');
  } catch (erreur) {
    ko(`DISCORD_SERVEUR_ID : serveur introuvable ou bot absent (${erreur.message})`);
  }
}

if (config.salonResultats && config.salonResultats === config.salonVotes) {
  ko('Les deux salons doivent être différents (les votes vont dans un salon à part).');
}

console.log(problemes
  ? `\n❌ ${problemes} point(s) à régler. Le guide pas à pas est dans le README (section Discord).\n`
  : '\n✅ Discord est prêt : relance le site, la page « Le mur des mandats » est active.\n');
process.exitCode = problemes ? 1 : 0;
