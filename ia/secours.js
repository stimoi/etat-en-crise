// =====================================================================
// secours.js — Les événements écrits à la main :
//  - le plan B quand l'IA ne répond pas (ou répond mal) ;
//  - les événements du calendrier (rentrée, budget, bac...).
// =====================================================================

import { EVENEMENTS_SECOURS } from '../data/evenements-secours.js';
import { EVENEMENTS_SCENARISES } from '../data/evenements-scenarises.js';
import { validerEvenement } from './validation.js';

// Validation au DÉMARRAGE du serveur, une seule fois : si tu ajoutes un
// événement avec une faute, le serveur refuse de démarrer et te dit lequel.
// On garde la version validée (normalisée) : plus rien à vérifier en cours de partie.
function preparer(liste, nomListe) {
  return liste.map((evenement, i) => {
    try {
      return { ...validerEvenement(evenement), mois: evenement.mois ?? null };
    } catch (erreur) {
      throw new Error(`${nomListe} n° ${i + 1} invalide : ${erreur.message}`);
    }
  });
}

const SECOURS = preparer(EVENEMENTS_SECOURS, 'Événement de secours');
const SCENARISES = preparer(EVENEMENTS_SCENARISES, 'Événement scénarisé');

// Copie sans le champ "mois" (inutile au navigateur), pour que rien ne
// puisse modifier les listes d'origine par accident.
function copie({ mois, ...evenement }) {
  return structuredClone(evenement);
}

// Tire un événement de secours au hasard en évitant ceux joués récemment.
export function tirerEvenementSecours(titresRecents = []) {
  const nonJoues = SECOURS.filter((evenement) => !titresRecents.includes(evenement.titre));
  // Si tout a déjà été joué récemment, on reprend dans la liste complète.
  const candidats = nonJoues.length > 0 ? nonJoues : SECOURS;
  return copie(candidats[Math.floor(Math.random() * candidats.length)]);
}

// Renvoie l'événement du calendrier à jouer ce tour-ci, ou null.
// calendrier : { mois (0 = janvier), periode (0 = début de mois) }
export function trouverEvenementDuCalendrier(calendrier, titresRecents = []) {
  if (!calendrier || calendrier.periode !== 0) return null;
  const evenement = SCENARISES.find(
    (candidat) => candidat.mois === calendrier.mois + 1 && !titresRecents.includes(candidat.titre),
  );
  return evenement ? copie(evenement) : null;
}

// Pour « npm run verifier » et les tests.
export const NOMBRE_SECOURS = SECOURS.length;
export const MOIS_SCENARISES = SCENARISES.map((evenement) => evenement.mois);
