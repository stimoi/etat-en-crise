// =====================================================================
// api/mur.js — Le cœur des routes du « mur des mandats » (sans Express).
//  lister(tri, joueur)                    → toutes les publications
//  publierResultat(corps, joueur)          → publier son résultat
//  voterResultat(id, corps, joueur)        → liker / disliker / annuler
//  lireCommentaires(id)                    → lire les commentaires
//  commenterResultat(id, corps, joueur)    → commenter
// =====================================================================

import { stockageConfigure } from '../discord/config.js';
import {
  listerPublications, publier, voter, listerCommentaires, commenter, LIBELLES_CAUSES,
} from '../discord/mur.js';
import { ok, erreur, texte, limiter } from './outils.js';

// Les identifiants Discord sont des nombres de 17 à 20 chiffres.
const ID_VALIDE = /^\d{5,25}$/;

// Si les réglages Discord manquent, on répond clairement au lieu de planter.
function verifierConfiguration() {
  return stockageConfigure()
    ? null
    : erreur(503, 'Le mur des mandats n\'est pas encore relié à Discord (voir le README).', { configure: false });
}

const nonConnecte = () => erreur(401, 'Connecte-toi avec Discord pour faire ça.');

// Toute erreur Discord devient un message lisible (et les détails vont dans le terminal).
function gererErreur(probleme) {
  if (probleme.statut === 404 && probleme.message === 'Publication introuvable') {
    return erreur(404, 'Cette publication n\'existe plus.');
  }
  console.warn(`[Mur] ${probleme.message}`);
  return erreur(502, 'Discord ne répond pas comme prévu. Réessaie dans un instant.');
}

export async function lister(tri, joueur) {
  const configuration = verifierConfiguration();
  if (configuration) return configuration;
  try {
    return ok({ resultats: await listerPublications(joueur?.id, tri === 'top' ? 'top' : 'recent') });
  } catch (probleme) {
    return gererErreur(probleme);
  }
}

// Ce qu'on accepte d'une publication (les données viennent du navigateur).
function nettoyerPublication(corps) {
  const nombre = (valeur, min, max) => (Number.isFinite(valeur) ? Math.min(max, Math.max(min, valeur)) : min);
  return {
    titre: texte(corps?.titre, 80) || 'Un mandat sans titre',
    resume: texte(corps?.resume, 900) || 'L\'Histoire n\'a rien retenu. Pas même le café.',
    message: texte(corps?.message, 300),
    tours: Math.round(nombre(corps?.tours, 0, 10000)),
    cause: Object.hasOwn(LIBELLES_CAUSES, corps?.cause) ? corps.cause : 'popularite',
    dette: Math.round(nombre(corps?.dette, 0, 100000) * 10) / 10,
    periode: texte(corps?.periode, 60),
    reformes: Array.isArray(corps?.reformes) ? corps.reformes.slice(0, 3).map((r) => texte(r, 60)).filter(Boolean) : [],
  };
}

export async function publierResultat(corps, joueur) {
  const configuration = verifierConfiguration();
  if (configuration) return configuration;
  if (!joueur) return nonConnecte();
  const tropVite = limiter('publier', joueur.id, 30000);
  if (tropVite) return tropVite;
  try {
    return ok({ publication: await publier(joueur, nettoyerPublication(corps)) }, 201);
  } catch (probleme) {
    return gererErreur(probleme);
  }
}

export async function voterResultat(id, corps, joueur) {
  const configuration = verifierConfiguration();
  if (configuration) return configuration;
  if (!joueur) return nonConnecte();
  const valeur = corps?.valeur;
  if (!ID_VALIDE.test(id) || ![1, -1, 0].includes(valeur)) return erreur(400, 'Vote invalide.');
  const tropVite = limiter('voter', joueur.id, 500);
  if (tropVite) return tropVite;
  try {
    return ok(await voter(joueur, id, valeur));
  } catch (probleme) {
    return gererErreur(probleme);
  }
}

export async function lireCommentaires(id) {
  const configuration = verifierConfiguration();
  if (configuration) return configuration;
  if (!ID_VALIDE.test(id)) return erreur(400, 'Publication invalide.');
  try {
    return ok({ commentaires: await listerCommentaires(id) });
  } catch (probleme) {
    return gererErreur(probleme);
  }
}

export async function commenterResultat(id, corps, joueur) {
  const configuration = verifierConfiguration();
  if (configuration) return configuration;
  if (!joueur) return nonConnecte();
  const contenu = texte(corps?.texte, 500);
  if (!ID_VALIDE.test(id) || !contenu) return erreur(400, 'Écris un commentaire d\'abord.');
  const tropVite = limiter('commenter', joueur.id, 5000);
  if (tropVite) return tropVite;
  try {
    return ok({ commentaire: await commenter(joueur, id, contenu) }, 201);
  } catch (probleme) {
    return gererErreur(probleme);
  }
}
