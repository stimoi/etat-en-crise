// =====================================================================
// api.js — Parler à l'API de Discord (https://discord.com/developers/docs).
//
// Deux sortes d'appels :
//  - « au nom du bot » (jeton du bot) : lire et écrire dans les salons ;
//  - « au nom du joueur » (jeton OAuth) : seulement lire son profil.
// =====================================================================

import { configDiscord } from './config.js';

const attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

// Appel générique, avec gestion de la limite de vitesse de Discord :
// en cas de code 429 (« trop de requêtes »), Discord dit combien de temps
// attendre (retry_after) ; on attend puis on réessaie.
async function appeler(methode, chemin, { corps, autorisation, formulaire } = {}) {
  const { urlApi } = configDiscord();
  for (let essai = 1; essai <= 5; essai += 1) {
    const reponse = await fetch(`${urlApi}${chemin}`, {
      method: methode,
      headers: {
        Authorization: autorisation,
        // Discord exige un User-Agent de ce format pour les bots.
        'User-Agent': 'DiscordBot (https://localhost, 1.0) etat-en-crise',
        ...(corps && { 'Content-Type': 'application/json' }),
        ...(formulaire && { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      body: corps ? JSON.stringify(corps) : formulaire,
      signal: AbortSignal.timeout(10000),
    });

    if (reponse.status === 429) {
      const details = await reponse.json().catch(() => ({}));
      await attendre(Math.ceil((details.retry_after ?? 1) * 1000));
      continue;
    }
    if (!reponse.ok) {
      const details = await reponse.json().catch(() => ({}));
      const erreur = new Error(`Discord a répondu ${reponse.status} : ${details.message ?? 'erreur inconnue'}`);
      erreur.codeDiscord = details.code; // ex. 50001 = le bot n'a pas accès au salon
      erreur.statut = reponse.status;
      throw erreur;
    }
    return reponse.status === 204 ? null : reponse.json();
  }
  throw new Error('Discord : trop de requêtes, réessaie dans un instant');
}

// Appel au nom du bot.
export function appelBot(methode, chemin, corps) {
  return appeler(methode, chemin, { corps, autorisation: `Bot ${configDiscord().jetonBot}` });
}

// Appel au nom d'un joueur connecté (jeton OAuth).
export function appelJoueur(jetonAcces, chemin) {
  return appeler('GET', chemin, { autorisation: `Bearer ${jetonAcces}` });
}

// Échange OAuth (formulaire, sans jeton).
export function appelFormulaire(chemin, champs) {
  return appeler('POST', chemin, { formulaire: new URLSearchParams(champs).toString() });
}

// Lit TOUS les messages d'un salon (ou d'un fil), 100 par 100.
// Discord les renvoie du plus récent au plus ancien.
export async function listerMessages(salonId) {
  const tous = [];
  let avant = null;
  for (;;) {
    const page = await appelBot('GET', `/channels/${salonId}/messages?limit=100${avant ? `&before=${avant}` : ''}`);
    tous.push(...page);
    if (page.length < 100) return tous;
    avant = page.at(-1).id;
  }
}
