// =====================================================================
// api/outils.js — Petits outils communs au « cœur » du site.
//
// Le dossier api/ contient la logique de chaque route, SANS dépendre
// d'Express. Elle est utilisée par deux « adaptateurs » :
//  - routes/*.js        : le serveur Node (npm start, lancer-*.bat) ;
//  - relais/worker.js   : le relais Cloudflare Worker (version GitHub Pages).
// Chaque fonction reçoit des données simples et renvoie { statut, json }.
// =====================================================================

import { configDiscord } from '../discord/config.js';
import { lireJeton } from '../discord/session.js';

// Un texte envoyé par le navigateur, nettoyé et coupé à la bonne longueur.
export function texte(valeur, longueurMax) {
  return typeof valeur === 'string' ? valeur.trim().slice(0, longueurMax) : '';
}

// Réponses toutes prêtes
export const ok = (json, statut = 200) => ({ statut, json });
export const erreur = (statut, message, extra = {}) => ({ statut, json: { erreur: message, ...extra } });

// Qui est connecté ? La session arrive soit dans un cookie (serveur Node),
// soit dans l'en-tête « Authorization: Bearer ... » (version GitHub Pages :
// les cookies entre deux sites différents sont bloqués par les navigateurs).
// jetons : { cookie, autorisation } → { id, nom, avatar } ou null.
export function joueurDepuis({ cookie, autorisation }) {
  const { secretSession } = configDiscord();
  const porteur = typeof autorisation === 'string' && autorisation.startsWith('Bearer ') ? autorisation.slice(7) : null;
  const donnees = lireJeton(porteur ?? cookie, secretSession);
  return donnees ? { id: donnees.id, nom: donnees.nom, avatar: donnees.avatar } : null;
}

// Anti-spam : un même joueur (ou une même adresse) doit attendre « delaiMs »
// entre deux actions d'un même type. Renvoie null si c'est permis, sinon
// une réponse d'erreur prête à envoyer.
const dernieresActions = new Map();
export function limiter(nom, cle, delaiMs) {
  const maintenant = Date.now();
  const id = `${nom}:${cle}`;
  const attente = (dernieresActions.get(id) ?? 0) + delaiMs - maintenant;
  if (attente > 0) return erreur(429, `Doucement ! Réessaie dans ${Math.ceil(attente / 1000)} s.`);
  dernieresActions.set(id, maintenant);
  // Ménage de temps en temps, pour que la liste ne grossisse pas sans fin.
  if (dernieresActions.size > 5000) dernieresActions.clear();
  return null;
}
