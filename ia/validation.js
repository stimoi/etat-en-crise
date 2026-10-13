// =====================================================================
// validation.js — On ne fait jamais confiance à la réponse de l'IA.
//
// Une IA peut oublier un champ, renvoyer du texte autour du JSON, ou
// proposer un effet de -80 points. Ce fichier :
//  - REJETTE (lève une erreur) si la structure est cassée ;
//  - CORRIGE ce qui peut l'être (effet hors bornes, texte trop long,
//    personnage ou poste budgétaire inconnu).
//
// RÉTROCOMPATIBILITÉ : tous les formats successifs du jeu sont acceptés.
//  - v4 (actuel) : "budget" { type, poste, pourcentage | quantite+montantUnitaire | montant }
//  - v3 : "budget" { poste, quantite, coutUnitaireParMois, dureeMois }
//  - v2 : "budget" { poste, montantMensuel, dureeMois }
//  - v1 : "effets" avec une clé "dette" (coût immédiat en Md€).
// Le résultat a toujours la même forme :
//  { effets: { dette, popularite, economie, education, ordre },
//    budget: { type: 'ponctuel', poste, montant, ... }
//          | { type: 'permanent' | 'temporaire', poste, montantMensuel, dureeMois, ... } | null }
// Les montants du résultat sont dans le sens du DÉFICIT (positif = le creuse).
// =====================================================================

import { NOMS_JAUGES, bornesEffet, BORNES_BUDGET, arrondi1, arrondiMillion } from '../public/regles.js';
import { trouverLigne, normaliserPoste } from '../public/donnees-budget.js';
import { IDS_PERSONNAGES } from '../data/personnages.js';

// Garde-fous d'affichage : un texte plus long est coupé avec « … ».
const LONGUEUR_MAX = { titre: 80, description: 400, texte: 120, reaction: 400, resume: 900 };

// Les jauges que l'IA DOIT toujours renseigner (la dette passe par "budget").
const JAUGES_OBLIGATOIRES = NOMS_JAUGES.filter((nom) => nom !== 'dette');

/**
 * Événement du tour. Renvoie :
 * { titre, description, personnage: 'id' | null, choix: [{ texte, effets, budget } x3] }
 */
export function validerEvenement(donnees) {
  const objet = lireObjet(donnees);

  const titre = texteObligatoire(objet.titre, 'titre', LONGUEUR_MAX.titre);
  const description = texteObligatoire(objet.description, 'description', LONGUEUR_MAX.description);

  if (!Array.isArray(objet.choix) || objet.choix.length !== 3) {
    throw new Error('Il faut exactement 3 choix');
  }

  const choix = objet.choix.map((unChoix, i) => ({
    texte: texteObligatoire(unChoix?.texte, `choix ${i + 1} → texte`, LONGUEUR_MAX.texte),
    effets: validerEffets(unChoix?.effets, `choix ${i + 1}`),
    budget: validerBudget(unChoix?.budget, `choix ${i + 1}`),
  }));

  // Le personnage est facultatif : s'il est absent ou inventé par l'IA, on l'ignore
  // plutôt que de jeter tout l'événement.
  const personnage = IDS_PERSONNAGES.includes(objet.personnage) ? objet.personnage : null;

  // On reconstruit un objet neuf : les éventuels champs en trop envoyés
  // par l'IA ne passent pas jusqu'au navigateur.
  return { titre, description, personnage, choix };
}

/**
 * Évaluation d'une décision écrite par le joueur. Renvoie :
 * { acceptable, texte, reaction, effets, budget }
 */
export function validerChoixLibre(donnees) {
  const objet = lireObjet(donnees);
  if (typeof objet.acceptable !== 'boolean') {
    throw new Error('Champ « acceptable » manquant ou non booléen');
  }
  const reaction = texteObligatoire(objet.reaction, 'reaction', LONGUEUR_MAX.reaction);

  // Proposition refusée : pas besoin du reste, et surtout aucun effet appliqué.
  if (!objet.acceptable) {
    return { acceptable: false, texte: '', reaction, effets: null, budget: null };
  }

  return {
    acceptable: true,
    texte: texteObligatoire(objet.texte, 'texte', LONGUEUR_MAX.texte),
    reaction,
    effets: validerEffets(objet.effets, 'proposition du joueur'),
    budget: validerBudget(objet.budget, 'proposition du joueur'),
  };
}

/**
 * Décision prise pendant une discussion (page Discussion).
 * Renvoie null s'il n'y a pas de décision, sinon { texte, effets, budget }.
 */
export function validerDecisionDiscussion(donnees) {
  const objet = lireObjet(donnees);
  if (objet.decision !== true) return null;
  return {
    texte: texteObligatoire(objet.texte, 'texte', LONGUEUR_MAX.texte),
    effets: validerEffets(objet.effets, 'décision de la discussion'),
    budget: validerBudget(objet.budget, 'décision de la discussion'),
  };
}

/** Verdict de fin de partie. Renvoie { titre, resume } */
export function validerBilan(donnees) {
  const objet = lireObjet(donnees);
  return {
    titre: texteObligatoire(objet.titre, 'titre', LONGUEUR_MAX.titre),
    resume: texteObligatoire(objet.resume, 'resume', LONGUEUR_MAX.resume),
  };
}

// ---------------------------------------------------------------------
// Outils communs
// ---------------------------------------------------------------------

function lireObjet(donnees) {
  const objet = typeof donnees === 'string' ? extraireJson(donnees) : donnees;
  if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
    throw new Error('Réponse vide ou qui n\'est pas un objet JSON');
  }
  return objet;
}

// Les IA entourent souvent le JSON de ```json ... ``` ou d'une phrase
// (« Voici l'événement : »). On garde ce qui est entre la première { et la dernière }.
function extraireJson(texte) {
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut === -1 || fin <= debut) {
    throw new Error('Aucun JSON trouvé dans la réponse de l\'IA');
  }
  // JSON.parse lève une erreur si le JSON est mal formé : elle remonte au serveur.
  return JSON.parse(texte.slice(debut, fin + 1));
}

function texteObligatoire(valeur, champ, longueurMax) {
  if (typeof valeur !== 'string' || valeur.trim() === '') {
    throw new Error(`Champ « ${champ} » manquant ou vide`);
  }
  const propre = valeur.trim();
  return propre.length > longueurMax ? `${propre.slice(0, longueurMax - 1)}…` : propre;
}

const borner = (valeur, { min, max }) => Math.min(max, Math.max(min, valeur));

// typeof 'number' refuse les "12" (texte) ou true qu'une IA pourrait renvoyer.
const estUnNombre = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur);

function validerEffets(effets, ou) {
  if (!effets || typeof effets !== 'object') {
    throw new Error(`Effets manquants (${ou})`);
  }
  const propres = {};
  for (const nom of JAUGES_OBLIGATOIRES) {
    if (!estUnNombre(effets[nom])) {
      throw new Error(`Effet « ${nom} » manquant ou non numérique (${ou})`);
    }
    // Hors bornes → on ramène dans les bornes au lieu de tout jeter.
    propres[nom] = borner(Math.round(effets[nom]), bornesEffet(nom));
  }
  // Ancien format : coût ponctuel sur la dette. Absent → 0.
  propres.dette = estUnNombre(effets.dette) ? arrondi1(borner(effets.dette, bornesEffet('dette'))) : 0;
  return propres;
}


const formatQuantite = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const formatEuros = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const formatMilliards = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const formatPourcent = new Intl.NumberFormat('fr-FR', { signDisplay: 'exceptZero', maximumFractionDigits: 1 });

const TYPES = ['ponctuel', 'permanent', 'temporaire'];

/**
 * Mesure budgétaire. Absente, nulle ou à 0 → null.
 *
 * Format actuel (v4) — les montants sont dans le SENS DE LA LIGNE
 * (une dépense ou une recette qui augmente = positif), et 3 façons de chiffrer :
 *  - "pourcentage" : -50 = la ligne baisse de moitié (ex. santé -50 %) ;
 *  - "quantite" × "montantUnitaire" (en euros) : c'est NOUS qui multiplions,
 *    car les IA se trompent souvent sur les grands nombres ;
 *  - "montant" : en Md€ (par an pour une mesure qui dure, au total si ponctuelle).
 * C'est ce fichier qui convertit ensuite dans le sens du déficit.
 */
function validerBudget(budget, ou) {
  if (budget === null || budget === undefined || budget === 'aucun') return null;
  if (typeof budget !== 'object') {
    throw new Error(`Budget illisible (${ou})`);
  }
  if (!TYPES.includes(budget.type)) return validerAncienBudget(budget, ou);

  const poste = normaliserPoste(budget.poste);
  const ligne = trouverLigne(poste);
  const ponctuel = budget.type === 'ponctuel';

  // 1. Variation de la ligne, en Md€ (par an, ou au total si ponctuelle).
  let variation;
  let calcul;
  if (estUnNombre(budget.pourcentage)) {
    const pourcentage = borner(budget.pourcentage, BORNES_BUDGET.pourcentage);
    variation = (ligne.montantAn * pourcentage) / 100;
    calcul = `${ligne.libelle} ${formatPourcent.format(pourcentage)} % (sur ${formatMilliards.format(ligne.montantAn)} Md€/an)`;
  } else if (estUnNombre(budget.quantite) && budget.quantite > 0 && estUnNombre(budget.montantUnitaire)) {
    // Pour une mesure qui dure, le montant unitaire est par mois (× 12 pour l'année)
    // ou par an si l'IA l'indique (les IA raisonnent souvent à l'année).
    const parAn = budget.periodeUnitaire === 'an';
    variation = (budget.quantite * budget.montantUnitaire * (ponctuel || parAn ? 1 : 12)) / 1e9;
    const unite = typeof budget.unite === 'string' ? ` ${budget.unite.trim().slice(0, 30)}` : '';
    const periode = ponctuel ? '' : parAn ? '/an' : '/mois';
    calcul = `${formatQuantite.format(budget.quantite)}${unite} × ${formatEuros.format(budget.montantUnitaire)} €${periode}`;
  } else if (estUnNombre(budget.montant)) {
    variation = budget.montant;
  } else {
    throw new Error(`Budget incomplet : il faut pourcentage, quantite + montantUnitaire, ou montant (${ou})`);
  }
  if (!calcul && typeof budget.calcul === 'string' && budget.calcul.trim()) {
    calcul = budget.calcul.trim().slice(0, 140);
  }

  // 2. Conversion dans le sens du déficit : plus de recettes = moins de déficit.
  const impact = ligne.nature === 'recette' ? -variation : variation;

  if (ponctuel) {
    const montant = arrondiMillion(borner(impact, BORNES_BUDGET.ponctuel));
    return montant === 0 ? null : { type: 'ponctuel', poste, montant, ...(calcul && { calcul }) };
  }

  const montantMensuel = arrondiMillion(borner(impact / 12, BORNES_BUDGET.montantMensuel));
  if (montantMensuel === 0) return null;
  const temporaire = budget.type === 'temporaire';
  return {
    type: temporaire ? 'temporaire' : 'permanent',
    poste,
    montantMensuel,
    dureeMois: temporaire ? borner(Math.round(estUnNombre(budget.dureeMois) ? budget.dureeMois : 12), BORNES_BUDGET.dureeMois) : null,
    ...(calcul && { calcul }),
  };
}

// Anciens formats (v2 et v3) : montants déjà dans le sens du déficit, en Md€/mois,
// avec une durée en mois. 1 mois = dépense ponctuelle.
function validerAncienBudget(budget, ou) {
  if (!estUnNombre(budget.dureeMois)) {
    throw new Error(`Budget incomplet : type ou dureeMois obligatoire (${ou})`);
  }
  let montantMensuel;
  if (estUnNombre(budget.quantite) && budget.quantite > 0 && estUnNombre(budget.coutUnitaireParMois)) {
    montantMensuel = (budget.quantite * budget.coutUnitaireParMois) / 1e9;
  } else if (estUnNombre(budget.montantMensuel)) {
    montantMensuel = budget.montantMensuel;
  } else {
    throw new Error(`Budget incomplet : montantMensuel manquant (${ou})`);
  }
  const poste = normaliserPoste(budget.poste);
  const dureeMois = borner(Math.round(budget.dureeMois), BORNES_BUDGET.dureeMois);
  if (dureeMois === 1) {
    const montant = arrondiMillion(borner(montantMensuel, BORNES_BUDGET.ponctuel));
    return montant === 0 ? null : { type: 'ponctuel', poste, montant };
  }
  const arrondi = arrondiMillion(borner(montantMensuel, BORNES_BUDGET.montantMensuel));
  return arrondi === 0 ? null : { type: 'temporaire', poste, montantMensuel: arrondi, dureeMois };
}
