// =====================================================================
// commun.js — Morceaux de prompt partagés par toutes les demandes à l'IA.
//
// Les règles de contenu et les repères budgétaires sont écrits UNE seule
// fois ici. Tout ce qui ne change jamais est calculé au chargement du
// serveur (et pas à chaque requête).
// =====================================================================

import {
  NOMS_JAUGES, LIBELLES_JAUGES, BORNES_EFFETS, DETTE_MAX, JAUGES_FATALES,
  budgetDuMois, ratioDettePib, libelleDate,
} from '../../public/regles.js';
import {
  COMPTES_2025, LIGNES_DEPENSES, LIGNES_RECETTES, POPULATION, trouverLigne,
} from '../../public/donnees-budget.js';
import { PERSONNAGES } from '../../data/personnages.js';

const { autres } = BORNES_EFFETS;
const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const formatSigne = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const formatEntier = new Intl.NumberFormat('fr-FR');
const pourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const REGLES_CONTENU = `RÈGLES DE CONTENU — OBLIGATOIRES
- INTERDIT : nommer ou évoquer une personnalité politique réelle, un parti politique réel, un syndicat réel ou toute personne réelle. INTERDIT de parodier une personne réelle. INTERDIT tout message partisan ou toute prise de position politique.
- Les seuls personnages nommés autorisés sont les personnages récurrents fictifs du jeu ; les autres sont des fonctions anonymes (« un préfet », « la ministre de l'Éducation »).
- Ton : humour absurde et bienveillant. Jamais de moquerie envers un groupe de personnes (origine, religion, genre, handicap, métier, âge, région...). On rit des situations, jamais des gens.
- Tout est écrit en français.`;

// Format d'UN choix, commun à l'événement et au choix libre.
export const FORMAT_EFFETS = '{"popularite": 0, "economie": 0, "education": 0, "ordre": 0}';
export const FORMAT_BUDGET = '{"calcul": "...", "type": "permanent", "poste": "sante", "pourcentage": -10}';

// Les lignes, avec leur identifiant et leur montant réel : l'IA les cite telles quelles.
const decrireLignes = (lignes) => lignes
  .filter((ligne) => ligne.modifiable !== false)
  .map((ligne) => `"${ligne.id}" ${ligne.libelle} ${format.format(ligne.montantAn)} Md€${ligne.detail ? ` (${ligne.detail})` : ''}`)
  .join(' ; ');

// Les bornes viennent de regles.js : si tu les changes là-bas, les prompts suivent.
export const SENS_DES_EFFETS = `SENS DES EFFETS
- "effets" : 4 jauges de 0 à 100 : "popularite", "economie", "education", "ordre". Positif = bon, négatif = mauvais. Entiers entre ${autres.min} et ${autres.max}. Les 4 clés sont TOUJOURS présentes (0 si aucun effet).
  Décision ordinaire : entre -10 et +10. Décision radicale ou historique : jusqu'à ${autres.min} / +${autres.max}.
- "budget" : ce que la décision change dans les finances publiques, ou null si elle ne coûte et ne rapporte rien.
  Format : ${FORMAT_BUDGET}
  - "calcul" : ton raisonnement en quelques mots, écrit AVANT les chiffres.
  - "type" : "ponctuel" (une seule fois, tout de suite), "permanent" (change le budget pour toujours) ou "temporaire" (ajoute alors "dureeMois", entier de 1 à 36).
  - "poste" : l'identifiant d'UNE ligne du budget (liste plus bas). Une dépense OU une recette.
  - Le montant, dans le SENS DE LA LIGNE (la ligne augmente = positif, la ligne baisse = négatif), au choix :
    • "pourcentage" : variation de TOUTE la ligne, de -100 (supprimée) à +100 (doublée). Seulement quand la mesure touche le système entier (supprimer l'armée, baisser TOUTES les retraites de 10 %, augmenter la TVA).
    • "quantite" + "unite" + "montantUnitaire" + "periodeUnitaire" : nombre de personnes ou d'objets × euros par unité. "periodeUnitaire" vaut "mois" ou "an" selon ce que représente ton montant (ex. cantine : 3 € × 180 jours d'école = 540 € → "an" ; prime de 100 € par mois → "mois"). Pour une mesure ponctuelle, mets le prix total par unité. OBLIGATOIRE pour une mesure ciblée sur un groupe (les lycéens, les policiers, les agriculteurs...). Le jeu fait la multiplication : ne la fais PAS.
    • "montant" : en milliards d'euros (par an si la mesure dure, au total si ponctuelle).
  - Exemples de sens : baisser la TVA → "poste": "tva", pourcentage NÉGATIF. Créer une taxe → une ligne de recette, valeur POSITIVE. Recruter des policiers → "securite", POSITIF. Fermer des hôpitaux → "sante", NÉGATIF.`;

// Les vrais chiffres, pour que l'IA chiffre ses mesures de façon cohérente.
export const REPERES_BUDGET = `REPÈRES RÉELS — finances de TOUTES les administrations publiques (État, Sécurité sociale, collectivités), Insee
- Chaque année : ≈ ${format.format(COMPTES_2025.depenses)} Md€ de dépenses, ≈ ${format.format(COMPTES_2025.recettes)} Md€ de recettes, ≈ ${format.format(COMPTES_2025.deficit)} Md€ de déficit (≈ ${format.format(COMPTES_2025.deficit / 12)} Md€ par mois qui s'ajoutent à la dette).
- Lignes de DÉPENSES (par an) : ${decrireLignes(LIGNES_DEPENSES)}.
- Lignes de RECETTES (par an) : ${decrireLignes(LIGNES_RECETTES)}.
- Population : ≈ ${formatEntier.format(POPULATION.habitants)} habitants, ${formatEntier.format(POPULATION.eleves)} élèves dont ${formatEntier.format(POPULATION.lyceens)} lycéens, ${formatEntier.format(POPULATION.retraites)} retraités, ${formatEntier.format(POPULATION.agentsPublics)} agents publics.

SOUPLESSE — TRÈS IMPORTANT
- Le joueur peut tout décider, même l'extrême : supprimer l'assurance maladie, la TVA, l'armée, les retraites... Modélise-le à sa VRAIE échelle avec un "pourcentage" sur la bonne ligne.
  Exemples : supprimer l'assurance maladie → "sante", forte baisse (elle finance l'essentiel des dépenses publiques de santé) ; supprimer l'armée → "defense", -100 ; baisser toutes les retraites de 10 % → "retraites", -10.
- Une décision géante a des effets géants : économies ou pertes énormes, et jauges qui s'effondrent ou s'envolent en conséquence.
- Une petite décision coûte peu : une mesure symbolique se chiffre en millions d'euros, pas en milliards.`;

export const LISTE_PERSONNAGES = PERSONNAGES
  .map((p) => `- "${p.id}" : ${p.nom}, ${p.role} — ${p.trait}`)
  .join('\n');

// Schémas JSON réutilisés (envoyés à Ollama ; ignorés par certains modèles cloud).
export const SCHEMA_EFFETS = {
  type: 'object',
  properties: Object.fromEntries(NOMS_JAUGES.filter((nom) => nom !== 'dette').map((nom) => [nom, { type: 'integer' }])),
  required: NOMS_JAUGES.filter((nom) => nom !== 'dette'),
};
export const SCHEMA_BUDGET = {
  type: ['object', 'null'],
  properties: {
    calcul: { type: 'string' },
    type: { type: 'string', enum: ['ponctuel', 'permanent', 'temporaire'] },
    poste: { type: 'string' },
    pourcentage: { type: 'number' },
    quantite: { type: 'number' },
    unite: { type: 'string' },
    montantUnitaire: { type: 'number' },
    periodeUnitaire: { type: 'string', enum: ['mois', 'an'] },
    montant: { type: 'number' },
    dureeMois: { type: 'integer' },
  },
};

export function decrireJauges(jauges) {
  return NOMS_JAUGES.map((nom) => {
    if (nom === 'dette') {
      return `- ${LIBELLES_JAUGES.dette} : ${format.format(jauges.dette)} milliards d'euros, soit ${pourcent.format(ratioDettePib(jauges.dette))} du PIB (faillite à ${format.format(DETTE_MAX)})`;
    }
    // On signale à l'IA quelles jauges font perdre, pour qu'elle sache où mettre la pression.
    const fatale = JAUGES_FATALES.includes(nom) ? ' (partie perdue à 0)' : '';
    return `- ${LIBELLES_JAUGES[nom]} : ${jauges[nom]}/100${fatale}`;
  }).join('\n');
}

// La situation budgétaire actuelle : budget du mois + lignes déjà modifiées par le joueur.
export function decrireBudget(jauges, engagements) {
  const budget = budgetDuMois(jauges, engagements);
  const lignes = [
    `Finances publiques ce mois-ci : recettes ${format.format(budget.recettes)} Md€, dépenses ${format.format(budget.depenses)} Md€ (dont intérêts ${format.format(budget.chargeDette)}), déficit ${format.format(budget.deficit)} Md€.`,
  ];
  // Les lignes que le joueur a déjà modifiées : l'IA en tient compte (on ne supprime pas deux fois la TVA).
  const modifiees = [...budget.lignesDepenses, ...budget.lignesRecettes]
    .filter((ligne) => Math.abs(ligne.effectif - ligne.base) > 0.5)
    .map((ligne) => `  - ${ligne.libelle} : ${format.format(ligne.effectif)} Md€/an au lieu de ${format.format(ligne.base)}`);
  if (modifiees.length) lignes.push('Lignes déjà modifiées par le joueur :', ...modifiees);

  const temporaires = engagements.filter((e) => e.toursRestants !== null).length;
  if (temporaires) lignes.push(`Mesures temporaires en cours : ${temporaires}.`);
  return lignes.join('\n');
}

export function decrireDate(calendrier) {
  return libelleDate(calendrier);
}

// Transforme le journal des décisions en lignes lisibles pour l'IA.
// C'est ce qui donne de la « mémoire » au jeu : l'IA ne retient rien
// d'un appel à l'autre, donc on lui rappelle l'histoire à chaque fois.
export function decrireJournal(journal) {
  if (journal.length === 0) return 'aucune (début de partie)';
  return journal.map((decision) => {
    const personnage = PERSONNAGES.find((p) => p.id === decision.personnage);
    const avec = personnage ? ` (avec ${personnage.nom})` : '';
    const libre = decision.libre ? ' [idée personnelle du joueur]' : '';
    return `- Tour ${decision.tour} : « ${decision.titre} »${avec} → décision : « ${decision.choix} »${libre}`;
  }).join('\n');
}

// Pour le bilan : la ligne la plus modifiée, en clair.
export function decrireGrandesReformes(jauges, engagements) {
  const budget = budgetDuMois(jauges, engagements);
  return [...budget.lignesDepenses, ...budget.lignesRecettes]
    .map((ligne) => ({ ...ligne, ecart: ligne.effectif - ligne.base }))
    .filter((ligne) => Math.abs(ligne.ecart) > 1)
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
    .slice(0, 4)
    .map((ligne) => `${trouverLigne(ligne.id)?.libelle ?? ligne.id} ${formatSigne.format(ligne.ecart)} Md€/an`)
    .join(' ; ');
}
