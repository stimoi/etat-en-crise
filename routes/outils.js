// =====================================================================
// routes/outils.js — Petits outils pour brancher le cœur (api/) sur Express.
// =====================================================================

import { lireCookies, ecrireCookie, effacerCookie } from '../discord/session.js';
import { joueurDepuis } from '../api/outils.js';

// Qui est connecté ? → { id, nom, avatar } ou null.
export function joueurConnecte(req) {
  return joueurDepuis({ cookie: lireCookies(req).session, autorisation: req.get('authorization') });
}

// Envoie une réponse du cœur ({ statut, json }) au navigateur.
export function repondre(res, { statut = 200, json }) {
  res.status(statut).json(json);
}

// Envoie une redirection du cœur ({ redirection, cookies }) au navigateur.
export function redirigerAvecCookies(res, { redirection, cookies = [] }) {
  for (const { nom, valeur, duree, securise } of cookies) {
    if (duree > 0) ecrireCookie(res, nom, valeur, duree, securise);
    else effacerCookie(res, nom);
  }
  res.redirect(redirection);
}

// Refuse les requêtes envoyées depuis un AUTRE site (protection « CSRF »),
// en plus du cookie SameSite=Lax. Le navigateur indique toujours l'origine d'un POST.
export function memeOrigine(req, res, next) {
  const origine = req.get('origin');
  if (origine) {
    try {
      if (new URL(origine).host !== req.get('host')) return res.status(403).json({ erreur: 'Requête refusée.' });
    } catch {
      return res.status(403).json({ erreur: 'Requête refusée.' });
    }
  }
  next();
}
