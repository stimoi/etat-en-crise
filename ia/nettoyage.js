// =====================================================================
// nettoyage.js — Les données envoyées par le navigateur.
//
// Tout ce qui arrive du navigateur peut avoir été modifié (outils de
// développement, requête faite à la main...). Avant de l'insérer dans un
// prompt, on garde uniquement ce qui est attendu, au bon format et à la
// bonne taille.
//
// RÉTROCOMPATIBILITÉ : les anciennes versions du jeu envoyaient
// "derniersTitres" au lieu de "journal", et pas de calendrier ni de
// mesures. Ces requêtes restent acceptées (valeurs par défaut).
// =====================================================================

import {
  NOMS_JAUGES, VALEURS_DEPART, JAUGES_FATALES, LONGUEUR_MAX_CHOIX_LIBRE, BORNES_BUDGET, TOURS_PAR_MOIS,
} from '../public/regles.js';
import { normaliserPoste } from '../public/donnees-budget.js';
import { IDS_PERSONNAGES } from '../data/personnages.js';

const MAX_DECISIONS_EVENEMENT = 8; // mémoire envoyée à l'IA à chaque tour
const MAX_DECISIONS_BILAN = 30; // le bilan de fin peut regarder plus loin
const MAX_ENGAGEMENTS = 40;

function texte(valeur, longueurMax) {
  return typeof valeur === 'string' ? valeur.trim().slice(0, longueurMax) : '';
}

function entierEntre(valeur, min, max, parDefaut) {
  return Number.isInteger(valeur) && valeur >= min && valeur <= max ? valeur : parDefaut;
}

function numeroDeTour(valeur) {
  return entierEntre(valeur, 1, 100000, 1);
}

function nettoyerJauges(jaugesRecues = {}) {
  const jauges = {};
  for (const nom of NOMS_JAUGES) {
    const valeur = Number(jaugesRecues?.[nom]);
    jauges[nom] = Number.isFinite(valeur) ? Math.round(valeur * 10) / 10 : VALEURS_DEPART[nom];
  }
  return jauges;
}

// { annee, mois (0-11), periode (0-2) } — par défaut : le mois actuel, en début de mois.
function nettoyerCalendrier(calendrier) {
  const maintenant = new Date();
  return {
    annee: entierEntre(calendrier?.annee, 2000, 2200, maintenant.getFullYear()),
    mois: entierEntre(calendrier?.mois, 0, 11, maintenant.getMonth()),
    periode: entierEntre(calendrier?.periode, 0, TOURS_PAR_MOIS - 1, 0),
  };
}

// Une décision du journal : { tour, titre, choix, personnage, libre }
function nettoyerDecision(decision) {
  if (!decision || typeof decision !== 'object') return null;
  const titre = texte(decision.titre, 100);
  const choix = texte(decision.choix, LONGUEUR_MAX_CHOIX_LIBRE);
  if (!titre || !choix) return null;
  return {
    tour: numeroDeTour(decision.tour),
    titre,
    choix,
    personnage: IDS_PERSONNAGES.includes(decision.personnage) ? decision.personnage : null,
    libre: decision.libre === true,
  };
}

function nettoyerJournal(corps, nombreMax) {
  if (Array.isArray(corps?.journal)) {
    return corps.journal.slice(-nombreMax).map(nettoyerDecision).filter(Boolean);
  }
  // Ancien format : une simple liste de titres.
  if (Array.isArray(corps?.derniersTitres)) {
    return corps.derniersTitres
      .filter((titre) => typeof titre === 'string')
      .slice(-nombreMax)
      .map((titre, i) => ({ tour: i + 1, titre: titre.slice(0, 100), choix: '(inconnu)', personnage: null, libre: false }));
  }
  return [];
}

// Les mesures budgétaires en cours : { libelle, poste, montantMensuel, toursRestants }
// toursRestants = null pour une mesure permanente.
function nettoyerEngagements(liste) {
  if (!Array.isArray(liste)) return [];
  const { min, max } = BORNES_BUDGET.montantMensuel;
  return liste.slice(0, MAX_ENGAGEMENTS)
    .map((engagement) => ({
      libelle: texte(engagement?.libelle, 120),
      // Les anciens noms de postes (version « budget de l'État ») sont traduits.
      poste: normaliserPoste(engagement?.poste),
      // Le niveau de crise peut doubler un coût : on tolère jusqu'au double des bornes.
      montantMensuel: Math.min(max * 2, Math.max(min, Number(engagement?.montantMensuel))),
      toursRestants: engagement?.toursRestants === null
        ? null
        : entierEntre(engagement?.toursRestants, 1, BORNES_BUDGET.dureeMois.max * TOURS_PAR_MOIS, 0),
    }))
    .filter((engagement) => engagement.libelle
      && Number.isFinite(engagement.montantMensuel)
      && (engagement.toursRestants === null || engagement.toursRestants > 0));
}

// POST /api/evenement
export function nettoyerDemandeEvenement(corps) {
  return {
    tour: numeroDeTour(corps?.tour),
    jauges: nettoyerJauges(corps?.jauges),
    journal: nettoyerJournal(corps, MAX_DECISIONS_EVENEMENT),
    suite: nettoyerDecision(corps?.suite), // décision dont on veut la conséquence, ou null
    calendrier: nettoyerCalendrier(corps?.calendrier),
    engagements: nettoyerEngagements(corps?.engagements),
  };
}

// POST /api/choix-libre
export function nettoyerDemandeChoixLibre(corps) {
  const evenement = corps?.evenement ?? {};
  const choix = Array.isArray(evenement.choix) ? evenement.choix.slice(0, 3).map((t) => texte(t, 150)) : [];
  return {
    tour: numeroDeTour(corps?.tour),
    jauges: nettoyerJauges(corps?.jauges),
    calendrier: nettoyerCalendrier(corps?.calendrier),
    engagements: nettoyerEngagements(corps?.engagements),
    evenement: {
      titre: texte(evenement.titre, 100),
      description: texte(evenement.description, 400),
      choix,
    },
    // On retire < et > : le joueur ne peut pas fermer lui-même la balise
    // <proposition> du prompt pour y glisser de fausses instructions.
    proposition: texte(corps?.proposition, LONGUEUR_MAX_CHOIX_LIBRE).replace(/[<>]/g, ''),
  };
}

// POST /api/bilan
export function nettoyerDemandeBilan(corps) {
  const causesPossibles = ['dette', ...JAUGES_FATALES];
  return {
    tour: numeroDeTour(corps?.tour),
    jauges: nettoyerJauges(corps?.jauges),
    cause: causesPossibles.includes(corps?.cause) ? corps.cause : 'popularite',
    journal: nettoyerJournal(corps, MAX_DECISIONS_BILAN),
    calendrier: nettoyerCalendrier(corps?.calendrier),
    debut: corps?.debut ? nettoyerCalendrier({ ...corps.debut, periode: 0 }) : null,
    engagements: nettoyerEngagements(corps?.engagements),
  };
}

// Discussion : la situation du budget choisi (partie ou bac à sable).
// Absente (discussion libre, ancienne version de la page) → null.
export function nettoyerSituation(situation) {
  if (!situation || typeof situation !== 'object') return null;
  return {
    tour: numeroDeTour(situation.tour),
    jauges: nettoyerJauges(situation.jauges),
    engagements: nettoyerEngagements(situation.engagements),
  };
}
