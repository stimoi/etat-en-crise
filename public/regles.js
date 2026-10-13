// =====================================================================
// regles.js — Les règles du jeu, en un seul endroit.
//
// Ce fichier est dans /public pour que le NAVIGATEUR puisse le charger,
// mais le SERVEUR l'importe aussi (validation, prompts de l'IA).
// Avantage : si tu changes un seuil ici, il change partout à la fois.
// Ce fichier ne touche jamais au HTML : ce n'est que de la logique.
//
// Les vrais chiffres (dette, dépenses et recettes publiques) sont dans
// donnees-budget.js.
// =====================================================================

import {
  DETTE_DEPART, PIB, TAUX_APPARENT_DETTE, LIGNES_DEPENSES, LIGNES_RECETTES, trouverLigne,
} from './donnees-budget.js';

// L'ordre de cette liste sert partout (prompt, validation, effets).
export const NOMS_JAUGES = ['dette', 'popularite', 'economie', 'education', 'ordre'];

// Noms lisibles, utilisés dans les messages envoyés à l'IA.
export const LIBELLES_JAUGES = {
  dette: 'Dette publique',
  popularite: 'Popularité',
  economie: 'Économie',
  education: 'Éducation / jeunesse (lycéens)',
  ordre: 'Ordre public',
};

// Valeurs au début de la partie. La dette part du dernier chiffre de l'Insee.
export const VALEURS_DEPART = {
  dette: DETTE_DEPART,
  popularite: 50,
  economie: 50,
  education: 50,
  ordre: 50,
};

// Si la dette atteint ce montant, c'est la faillite (≈ 122,5 % du PIB).
// Sans aucune économie, le seul déficit public réel l'atteint en 8 mois de jeu.
export const DETTE_MAX = 3700;
// Bas de la barre de dette à l'écran (sinon elle serait toujours presque pleine).
export const DETTE_ECHELLE_MIN = 3400;

// Les jauges qui font perdre si elles tombent à 0.
export const JAUGES_FATALES = ['popularite', 'economie', 'ordre'];

// Effet maximal d'UN choix sur une jauge, AVANT difficulté. Large exprès :
// une décision extrême (supprimer l'assurance maladie...) doit pouvoir faire très mal.
// "dette" = somme payée ou encaissée IMMÉDIATEMENT (ancien format, toujours accepté).
export const BORNES_EFFETS = {
  dette: { min: -300, max: 300 },
  autres: { min: -30, max: 30 },
};

// Une mesure budgétaire, une fois convertie :
//  - pourcentage d'une ligne : de -100 % (supprimée) à +100 % (doublée) ;
//  - mesure qui dure : jusqu'à ±60 Md€ par mois (±720 Md€/an : de quoi supprimer les retraites) ;
//  - mesure ponctuelle : jusqu'à ±300 Md€ payés ou encaissés d'un coup.
export const BORNES_BUDGET = {
  pourcentage: { min: -100, max: 100 },
  montantMensuel: { min: -60, max: 60 },
  ponctuel: { min: -300, max: 300 },
  dureeMois: { min: 1, max: 36 },
};

// Longueur maximale d'une décision écrite par le joueur.
export const LONGUEUR_MAX_CHOIX_LIBRE = 150;

// Petits outils d'arrondi (évite les 3599.4000000001 des calculs à virgule).
export const arrondi1 = (nombre) => Math.round(nombre * 10) / 10;
// Les montants budgétaires sont gardés au million d'euros près (0,001 Md€).
export const arrondiMillion = (nombre) => Math.round(nombre * 1000) / 1000;

// ---------------------------------------------------------------------
// LE TEMPS : 3 tours = 1 mois (début, mi-, fin de mois)
// ---------------------------------------------------------------------
export const TOURS_PAR_MOIS = 3;
const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const PERIODES = ['Début', 'Mi-', 'Fin'];

// debut : { annee, mois (0 = janvier) } — le mois où la partie commence.
// Renvoie { annee, mois, periode (0 = début, 1 = mi-, 2 = fin) }.
export function dateDuTour(debut, tour) {
  const index = tour - 1;
  const moisAbsolu = debut.mois + Math.floor(index / TOURS_PAR_MOIS);
  return {
    annee: debut.annee + Math.floor(moisAbsolu / 12),
    mois: moisAbsolu % 12,
    periode: index % TOURS_PAR_MOIS,
  };
}

// { annee: 2026, mois: 9 } → « octobre 2026 »
export function libelleMois({ annee, mois }) {
  return `${NOMS_MOIS[mois]} ${annee}`;
}

// { annee: 2026, mois: 9, periode: 1 } → « Mi-octobre 2026 »
export function libelleDate({ annee, mois, periode }) {
  const prefixe = PERIODES[periode];
  const separateur = prefixe.endsWith('-') ? '' : ' ';
  return `${prefixe}${separateur}${NOMS_MOIS[mois]} ${annee}`;
}

// ---------------------------------------------------------------------
// DIFFICULTÉ CROISSANTE : les COÛTS des décisions grossissent avec le temps
// (« dérapages »). Les avantages, eux, ne bougent pas.
// ---------------------------------------------------------------------
export const HAUSSE_CRISE_PAR_TOUR = 0.03; // +3 % de coûts à chaque tour
export const NIVEAU_CRISE_MAX = 2; // les coûts ne dépassent jamais le double

export function niveauDeCrise(tour) {
  return Math.min(NIVEAU_CRISE_MAX, 1 + (tour - 1) * HAUSSE_CRISE_PAR_TOUR);
}

export function bornesEffet(nomJauge) {
  return nomJauge === 'dette' ? BORNES_EFFETS.dette : BORNES_EFFETS.autres;
}

// Un effet est un « coût » s'il fait du mal : une dette qui monte,
// ou n'importe quelle autre jauge qui baisse.
export function estUnCout(nomJauge, valeur) {
  return nomJauge === 'dette' ? valeur > 0 : valeur < 0;
}

// ---------------------------------------------------------------------
// LES FINANCES PUBLIQUES, LIGNE PAR LIGNE
//
// Une mesure en cours (« engagement ») : { libelle, poste, montantMensuel, toursRestants }
//  - poste : la ligne modifiée (santé, TVA...) ;
//  - montantMensuel : son effet sur le DÉFICIT, en Md€/mois (positif = le creuse) ;
//  - toursRestants : null = permanent, sinon nombre de tours avant la fin.
// ---------------------------------------------------------------------

// Les impôts rentrent mieux quand l'économie va bien : de -10 % (économie à 0)
// à +10 % (économie à 100). À 50, on retrouve exactement les chiffres de l'Insee.
export function facteurEconomie(economie) {
  return 0.9 + 0.2 * (economie / 100);
}

export function ratioDettePib(dette) {
  return dette / PIB;
}

/**
 * Les finances publiques pour UN mois.
 * Renvoie (montants mensuels en Md€) : recettes, depenses, chargeDette, mesures, deficit ;
 * et (montants ANNUELS) lignesDepenses / lignesRecettes : [{ id, libelle, emoji, base, effectif }].
 * À l'état initial : dépenses ≈ 143, recettes ≈ 130, déficit ≈ 12,9 Md€/mois (comme l'Insee).
 */
export function budgetDuMois(jauges, engagements = []) {
  // 1. Total des modifications par ligne, en Md€/an, dans le sens de la ligne
  //    (une dépense qui augmente ou une recette qui augmente = positif).
  const modifications = {};
  for (const engagement of engagements) {
    const ligne = trouverLigne(engagement.poste);
    if (!ligne) continue;
    const sens = ligne.nature === 'recette' ? -1 : 1;
    modifications[engagement.poste] = (modifications[engagement.poste] ?? 0) + sens * engagement.montantMensuel * 12;
  }

  // 2. Montant effectif de chaque ligne : jamais en dessous de 0
  //    (on ne peut pas supprimer plus que 100 % des retraites).
  //    Un reste de moins de 10 M€ vient des arrondis : une ligne « supprimée » vaut bien 0.
  const effectif = (ligne) => {
    const montant = ligne.montantAn + (modifications[ligne.id] ?? 0);
    return montant < 0.01 ? 0 : montant;
  };
  // "base" = la ligne sans aucune décision du joueur (pour une recette, elle suit
  // déjà l'économie) : c'est par rapport à elle qu'on mesure ce que le joueur a changé.
  const lignesDepenses = LIGNES_DEPENSES.map((ligne) => ({
    id: ligne.id, libelle: ligne.libelle, emoji: ligne.emoji,
    base: ligne.montantAn,
    effectif: effectif(ligne),
  }));
  const facteur = facteurEconomie(jauges.economie);
  const lignesRecettes = LIGNES_RECETTES.map((ligne) => ({
    id: ligne.id, libelle: ligne.libelle, emoji: ligne.emoji,
    base: ligne.montantAn * facteur,
    effectif: effectif(ligne) * facteur,
  }));

  // 3. Les intérêts suivent la dette : plus on emprunte, plus on paie.
  const interetsAn = jauges.dette * TAUX_APPARENT_DETTE;

  const somme = (lignes, cle) => lignes.reduce((total, ligne) => total + ligne[cle], 0);
  const depensesAn = somme(lignesDepenses, 'effectif') + interetsAn;
  const recettesAn = somme(lignesRecettes, 'effectif');
  // Effet net des décisions du joueur sur le déficit (positif = le creuse).
  const mesuresAn = (somme(lignesDepenses, 'effectif') - somme(lignesDepenses, 'base'))
    - (somme(lignesRecettes, 'effectif') - somme(lignesRecettes, 'base'));

  return {
    recettes: recettesAn / 12,
    depenses: depensesAn / 12,
    chargeDette: interetsAn / 12,
    mesures: mesuresAn / 12,
    deficit: (depensesAn - recettesAn) / 12,
    lignesDepenses,
    lignesRecettes,
  };
}

// Renvoie de NOUVELLES jauges (on ne modifie pas l'objet reçu :
// ça évite les bugs où l'ancien état change « tout seul »).
export function appliquerEffets(jauges, effets) {
  const nouvelles = { ...jauges };
  for (const nom of NOMS_JAUGES) {
    const total = jauges[nom] + (effets[nom] ?? 0);
    // La dette n'a pas de plafond (c'est DETTE_MAX qui arrête la partie) ;
    // les autres jauges restent entre 0 et 100.
    nouvelles[nom] = nom === 'dette' ? arrondi1(Math.max(0, total)) : Math.min(100, Math.max(0, total));
  }
  return nouvelles;
}

// Différence entre deux jeux de jauges (ce qui a VRAIMENT changé : si une jauge
// était déjà à 100, un « +8 » ne change rien, et c'est ce qu'il faut afficher).
function differences(avant, apres) {
  const variations = {};
  for (const nom of NOMS_JAUGES) {
    const difference = apres[nom] - avant[nom];
    variations[nom] = nom === 'dette' ? arrondi1(difference) : difference;
  }
  return variations;
}

/**
 * Applique une décision TOUT DE SUITE, sans faire avancer le temps :
 *  - effets sur les jauges (les coûts sont gonflés par le niveau de crise) ;
 *  - une dépense ou une recette ponctuelle tombe immédiatement sur la dette ;
 *  - une mesure permanente ou temporaire rejoint les mesures en cours.
 * Utilisé par le jeu (via resoudreDecision) et par la page Discussion
 * (une décision prise en conversation ne fait pas passer de tour).
 *
 * situation : { jauges, engagements }
 * decision  : { texte, effets, budget } — budget validé par ia/validation.js :
 *   { type: 'ponctuel', poste, montant } ou { type: 'permanent' | 'temporaire', poste, montantMensuel, dureeMois }
 *
 * Renvoie : jauges, engagements, variations, budgetAvant, budget, ponctuel, nouvelEngagement.
 */
export function appliquerMesure({ jauges, engagements = [] }, decision, tour) {
  const crise = niveauDeCrise(tour);
  const budgetAvant = budgetDuMois(jauges, engagements);
  // Un coût « dérape » avec la crise ; une économie, jamais.
  const avecCrise = (montant) => (montant > 0 ? montant * crise : montant);

  // 1. Effets immédiats sur les jauges.
  const effetsReels = {};
  for (const nom of NOMS_JAUGES) {
    const valeur = decision.effets?.[nom] ?? 0;
    const reel = estUnCout(nom, valeur) ? valeur * crise : valeur;
    effetsReels[nom] = nom === 'dette' ? arrondi1(reel) : Math.round(reel);
  }

  // 2. Le budget de la décision.
  const enCours = engagements.map((engagement) => ({ ...engagement }));
  let nouvelEngagement = null;
  let ponctuel = effetsReels.dette; // ancien format : coût immédiat dans "effets"
  const budget = decision.budget;
  if (budget?.type === 'ponctuel') {
    ponctuel += arrondi1(avecCrise(budget.montant));
  } else if (budget) {
    nouvelEngagement = {
      libelle: decision.texte,
      poste: budget.poste,
      montantMensuel: arrondiMillion(avecCrise(budget.montantMensuel)),
      toursRestants: budget.type === 'permanent' ? null : budget.dureeMois * TOURS_PAR_MOIS,
    };
    enCours.push(nouvelEngagement);
  }
  effetsReels.dette = ponctuel;
  const nouvellesJauges = appliquerEffets(jauges, effetsReels);

  return {
    jauges: nouvellesJauges,
    engagements: enCours,
    variations: differences(jauges, nouvellesJauges),
    budgetAvant,
    budget: budgetDuMois(nouvellesJauges, enCours),
    ponctuel,
    nouvelEngagement,
  };
}

/**
 * Joue une décision DU JEU : elle s'applique tout de suite (appliquerMesure),
 * puis le temps avance d'un tour (un tiers de mois).
 *
 * Renvoie : jauges, engagements, variations, budgetAvant, budget, detteDuTour,
 *           ponctuel, nouvelEngagement, termines.
 */
export function resoudreDecision(situation, decision, tour) {
  const mesure = appliquerMesure(situation, decision, tour);

  // Le budget tourne : un tiers du déficit du mois s'ajoute à la dette.
  // Il tient déjà compte de la nouvelle mesure : l'effet est immédiat.
  const detteDuTour = mesure.budget.deficit / TOURS_PAR_MOIS;
  const jauges = { ...mesure.jauges, dette: arrondi1(Math.max(0, mesure.jauges.dette + detteDuTour)) };

  // Le temps passe : les mesures temporaires ont un tiers de mois de moins.
  const restants = [];
  const termines = [];
  for (const engagement of mesure.engagements) {
    if (engagement.toursRestants === null) {
      restants.push(engagement);
      continue;
    }
    const suite = { ...engagement, toursRestants: engagement.toursRestants - 1 };
    (suite.toursRestants > 0 ? restants : termines).push(suite);
  }

  return {
    ...mesure,
    jauges,
    engagements: restants,
    variations: differences(situation.jauges, jauges),
    detteDuTour,
    termines,
  };
}

// Renvoie la raison de la défaite ('dette', 'popularite'...) ou null si on continue.
export function causeDeFin(jauges) {
  if (jauges.dette >= DETTE_MAX) return 'dette';
  return JAUGES_FATALES.find((nom) => jauges[nom] <= 0) ?? null;
}

// ---------------------------------------------------------------------
// ÉVÉNEMENTS EN CHAÎNE
// De temps en temps, au lieu d'un événement neuf, on demande à l'IA
// la conséquence d'une décision prise 2 à 4 tours plus tôt.
// ---------------------------------------------------------------------
export const CHANCE_DE_SUITE = 0.3;

// journal : liste des décisions passées { tour, titre, choix, ... }
// toursDejaSuivis : tours dont la conséquence a déjà été jouée (une seule fois chacun)
export function choisirDecisionASuivre(journal, tour, toursDejaSuivis, hasard = Math.random) {
  if (hasard() >= CHANCE_DE_SUITE) return null;
  const candidates = journal.filter((decision) => {
    const ecart = tour - decision.tour;
    return ecart >= 2 && ecart <= 4 && !toursDejaSuivis.includes(decision.tour);
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(hasard() * candidates.length)];
}
