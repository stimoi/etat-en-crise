// =====================================================================
// config.js — Les réglages Discord, lus dans le fichier .env.
//
// On les lit au moment où on en a besoin (et pas au chargement du fichier),
// car server.js charge le .env APRÈS avoir importé les modules.
// =====================================================================

export function configDiscord() {
  // DISCORD_URL_BASE ne sert qu'aux tests (faux serveur Discord) : ne pas la remplir.
  const base = (process.env.DISCORD_URL_BASE || 'https://discord.com').replace(/\/$/, '');
  return {
    urlSite: base,
    urlApi: `${base}/api/v10`,
    modeTest: Boolean(process.env.DISCORD_URL_BASE),
    // Connexion des joueurs (« Se connecter avec Discord »)
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirection: process.env.DISCORD_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/auth/discord/callback`,
    secretSession: process.env.SESSION_SECRET,
    // Version GitHub Pages (relais Cloudflare) : l'adresse du site, ex. « https://pseudo.github.io ».
    // Vide pour le serveur Node classique.
    origineSite: (process.env.ORIGINE_SITE || '').replace(/\/$/, ''),
    // Ajout automatique des joueurs connectés sur ton serveur Discord
    serveurId: process.env.DISCORD_SERVEUR_ID,
    // (il faut le bot pour ajouter quelqu'un : sans jeton de bot, pas d'ajout)
    ajoutAutomatique: Boolean(process.env.DISCORD_SERVEUR_ID && process.env.DISCORD_BOT_TOKEN)
      && process.env.DISCORD_AJOUT_AUTO !== '0',
    // Bot qui stocke les données sur ton serveur Discord
    jetonBot: process.env.DISCORD_BOT_TOKEN,
    salonResultats: process.env.DISCORD_SALON_RESULTATS,
    salonVotes: process.env.DISCORD_SALON_VOTES,
    presence: process.env.DISCORD_PRESENCE !== '0',
  };
}

const MANQUANTS_CONNEXION = [['DISCORD_CLIENT_ID', 'clientId'], ['DISCORD_CLIENT_SECRET', 'clientSecret'], ['SESSION_SECRET', 'secretSession']];
const MANQUANTS_STOCKAGE = [['DISCORD_BOT_TOKEN', 'jetonBot'], ['DISCORD_SALON_RESULTATS', 'salonResultats'], ['DISCORD_SALON_VOTES', 'salonVotes']];

// Liste des variables .env encore vides (pour des messages d'erreur clairs).
export function reglagesManquants() {
  const config = configDiscord();
  return [...MANQUANTS_CONNEXION, ...MANQUANTS_STOCKAGE]
    .filter(([, cle]) => !config[cle])
    .map(([nom]) => nom);
}

export function connexionConfiguree() {
  const config = configDiscord();
  return MANQUANTS_CONNEXION.every(([, cle]) => config[cle]);
}

export function stockageConfigure() {
  const config = configDiscord();
  return MANQUANTS_STOCKAGE.every(([, cle]) => config[cle]);
}
