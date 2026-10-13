// =====================================================================
// partie.js — La sauvegarde, partagée entre le jeu et la page Discussion.
//
// Deux « budgets » peuvent être modifiés par les discussions :
//  - la PARTIE en cours du jeu (sauvegardée dans le navigateur à chaque tour,
//    elle survit au rechargement de la page) ;
//  - un BAC À SABLE, propre à la page Discussion, qui part des vrais chiffres.
//
// Le stockage du navigateur (localStorage) est partagé par tous les onglets
// du site : une décision prise en discussion se retrouve dans le jeu.
// Il peut être bloqué (navigation privée...) : on ne plante jamais, on
// fait simplement sans sauvegarde.
// =====================================================================

import { VALEURS_DEPART } from './regles.js';

export const CLE_PARTIE = 'etat-en-crise:partie';
export const CLE_BAC_A_SABLE = 'etat-en-crise:bac-a-sable';
export const CLE_MODE_DISCUSSION = 'etat-en-crise:mode-discussion';

// Numéro de version du format : si on le change un jour, les vieilles
// sauvegardes incompatibles seront simplement ignorées.
const VERSION = 1;

export function lire(cle) {
  try {
    const donnees = JSON.parse(localStorage.getItem(cle));
    return donnees?.version === VERSION ? donnees : null;
  } catch {
    return null;
  }
}

export function ecrire(cle, donnees) {
  try {
    localStorage.setItem(cle, JSON.stringify({ ...donnees, version: VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function effacer(cle) {
  try {
    localStorage.removeItem(cle);
  } catch {
    // rien à faire
  }
}

// Le bac à sable : les vrais chiffres de départ, sans aucune mesure.
export function nouveauBacASable() {
  return { jauges: { ...VALEURS_DEPART }, engagements: [], journal: [], tour: 1 };
}

export function lireBacASable() {
  return lire(CLE_BAC_A_SABLE) ?? nouveauBacASable();
}

// Le mode choisi sur la page Discussion : 'partie' ou 'bac'.
export function lireMode() {
  try {
    return localStorage.getItem(CLE_MODE_DISCUSSION) === 'bac' ? 'bac' : 'partie';
  } catch {
    return 'partie';
  }
}

export function ecrireMode(mode) {
  try {
    localStorage.setItem(CLE_MODE_DISCUSSION, mode);
  } catch {
    // rien à faire
  }
}
