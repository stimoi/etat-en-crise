// =====================================================================
// donnees-budget.js — Les VRAIS chiffres des finances publiques.
//
// Le jeu simule les dépenses et recettes de TOUTES les administrations
// publiques (État + Sécurité sociale + collectivités), comme l'Insee.
// C'est cohérent avec la dette affichée (la dette « publique » de l'Insee),
// et ça permet des décisions comme « supprimer l'assurance maladie »
// (qui relève de la Sécurité sociale, pas du budget de l'État).
//
// Sources (consultées en octobre 2026) :
//  - Insee, Informations rapides n° 239 (29/09/2026) : dette publique fin T2 2026.
//  - Insee, compte des administrations publiques 2025 : totaux, intérêts, déficit.
//  - Insee Première n° 2093 : dépenses publiques par fonction en 2024.
//  - COR, rapport annuel 2025 : dépenses de retraite 2024.
//  - IGF / Commission des comptes de la Sécurité sociale / Sénat : recettes par impôt.
// Pour mettre à jour : modifie ce fichier, puis lance « npm run verifier ».
// =====================================================================

export const SOURCES = [
  { libelle: 'Insee — dette publique fin T2 2026', url: 'https://www.insee.fr/fr/statistiques/9053525' },
  { libelle: 'Insee — dépenses publiques par fonction 2024', url: 'https://www.insee.fr/fr/statistiques/8735252' },
  { libelle: 'Insee — compte des administrations publiques 2025', url: 'https://www.insee.fr/fr/statistiques/8997691' },
  { libelle: 'COR — dépenses de retraite 2024', url: 'https://www.cor-retraites.fr/sites/default/files/2025-06/Synth%C3%A8se_Def_.pdf' },
  { libelle: 'FIPECO — prélèvements obligatoires', url: 'https://www.fipeco.fr/fiche/La-d%C3%A9finition,-le-niveau-et-la-r%C3%A9partition-des-pr%C3%A9l%C3%A8vements-obligatoires' },
];

// ---------------------------------------------------------------------
// Dette publique (toutes administrations, « au sens de Maastricht »)
// ---------------------------------------------------------------------
export const DETTE_DEPART = 3595.5; // Md€, fin du 2e trimestre 2026 (Insee)
export const RATIO_DETTE_PIB_DEPART = 1.19; // 119,0 % du PIB (Insee)
// PIB annuel déduit des deux chiffres ci-dessus (≈ 3 021 Md€).
export const PIB = Math.round((DETTE_DEPART / RATIO_DETTE_PIB_DEPART) * 10) / 10;

// ---------------------------------------------------------------------
// Totaux 2025 des administrations publiques (Insee), en Md€ par an
// ---------------------------------------------------------------------
export const COMPTES_2025 = {
  depenses: 1714.2,
  recettes: 1561.7,
  deficit: 152.5, // 5,1 % du PIB
  interets: 64.7,
  detteFin2025: 3460.5,
};

// Taux d'intérêt « apparent » : ce que coûte la dette chaque année, rapporté
// à son montant (≈ 1,9 %). La charge d'intérêts du jeu suit donc la dette.
export const TAUX_APPARENT_DETTE = COMPTES_2025.interets / COMPTES_2025.detteFin2025;

// ---------------------------------------------------------------------
// DÉPENSES par grande fonction (Md€ par an). Insee 2024, sauf mention.
// Une décision du jeu peut modifier n'importe laquelle de ces lignes
// (ex. « -50 % » sur la santé). Les intérêts, eux, se calculent tout seuls.
// ---------------------------------------------------------------------
export const LIGNES_DEPENSES = [
  { id: 'retraites', libelle: 'Retraites', emoji: '👵', montantAn: 407, detail: 'pensions de base et complémentaires (COR, 2024)' },
  { id: 'protection-sociale', libelle: 'Autre protection sociale', emoji: '🤝', montantAn: 286, detail: 'famille 67, chômage 49, invalidité, pauvreté, aides au logement…' },
  { id: 'sante', libelle: 'Santé', emoji: '🏥', montantAn: 261, detail: 'hôpitaux, médicaments, soins remboursés (assurance maladie)' },
  { id: 'economie', libelle: 'Affaires économiques', emoji: '🏭', montantAn: 166, detail: 'transports, énergie, agriculture, aides aux entreprises, recherche appliquée' },
  { id: 'enseignement', libelle: 'Enseignement', emoji: '🎒', montantAn: 149, detail: 'écoles, collèges, lycées, universités' },
  { id: 'administration', libelle: 'Administration générale', emoji: '🏛️', montantAn: 121, detail: 'services généraux hors intérêts de la dette' },
  { id: 'defense', libelle: 'Défense', emoji: '🪖', montantAn: 54 },
  { id: 'securite', libelle: 'Ordre et sécurité', emoji: '🚓', montantAn: 52, detail: 'police, gendarmerie, justice, prisons, pompiers' },
  { id: 'culture', libelle: 'Culture, sport, loisirs', emoji: '🎭', montantAn: 43 },
  { id: 'logement', libelle: 'Logement et équipements', emoji: '🏘️', montantAn: 42 },
  { id: 'environnement', libelle: 'Environnement', emoji: '🌱', montantAn: 30 },
  // Les dépenses 2025 sont connues au total mais pas encore par fonction :
  // cette ligne fait la différence (calculée), pour retomber sur le total 2025.
  { id: 'non-ventile', libelle: 'Hausse 2025 non ventilée', emoji: '📦', montantAn: 38.5, modifiable: false },
];

// La ligne des intérêts (dynamique : dette × taux apparent).
export const LIGNE_INTERETS = { id: 'interets', libelle: 'Intérêts de la dette', emoji: '💸' };

// ---------------------------------------------------------------------
// RECETTES (Md€ par an). Dernier chiffre connu pour chaque impôt.
// "autres-recettes" = total 2025 de l'Insee moins les lignes listées (calculé).
// ---------------------------------------------------------------------
export const LIGNES_RECETTES = [
  { id: 'cotisations', libelle: 'Cotisations sociales', emoji: '🧾', montantAn: 462.3, detail: 'IGF, 2023' },
  { id: 'tva', libelle: 'TVA', emoji: '🛒', montantAn: 210.7, detail: '2024' },
  { id: 'csg', libelle: 'CSG', emoji: '📄', montantAn: 153.8, detail: 'Commission des comptes, 2024' },
  { id: 'ir', libelle: 'Impôt sur le revenu', emoji: '💶', montantAn: 88.7, detail: 'IGF, 2023' },
  { id: 'is', libelle: 'Impôt sur les sociétés', emoji: '🏢', montantAn: 57.4, detail: 'net, 2024' },
  { id: 'autres-recettes', libelle: 'Autres impôts et recettes', emoji: '💰', montantAn: 588.8, detail: 'taxes locales, carburants, ventes, revenus…' },
];

// Toutes les lignes, avec leur nature, pour les retrouver par identifiant.
const TOUTES_LES_LIGNES = [
  ...LIGNES_DEPENSES.map((ligne) => ({ ...ligne, nature: 'depense' })),
  ...LIGNES_RECETTES.map((ligne) => ({ ...ligne, nature: 'recette' })),
  { ...LIGNE_INTERETS, nature: 'depense', modifiable: false },
];

export function trouverLigne(id) {
  return TOUTES_LES_LIGNES.find((ligne) => ligne.id === id) ?? null;
}

// Les lignes qu'une décision a le droit de modifier.
export const IDS_LIGNES_MODIFIABLES = TOUTES_LES_LIGNES
  .filter((ligne) => ligne.modifiable !== false)
  .map((ligne) => ligne.id);

// RÉTROCOMPATIBILITÉ : les anciennes versions du jeu (budget de l'État seul)
// utilisaient d'autres identifiants. On les traduit vers les nouvelles lignes.
export const ANCIENS_POSTES = {
  enseignement: 'enseignement',
  defense: 'defense',
  securites: 'securite',
  solidarite: 'protection-sociale',
  ecologie: 'environnement',
  territoires: 'logement',
  travail: 'economie',
  recherche: 'economie',
  autres: 'administration',
  impots: 'autres-recettes',
};

// Traduit n'importe quel identifiant (nouveau ou ancien) en ligne modifiable.
// Inconnu → « administration », pour garder la mesure plutôt que de la perdre.
export function normaliserPoste(id) {
  if (IDS_LIGNES_MODIFIABLES.includes(id)) return id;
  return ANCIENS_POSTES[id] ?? 'administration';
}

// Repères de population (ordres de grandeur) pour chiffrer une mesure.
export const POPULATION = {
  habitants: 68_000_000,
  eleves: 12_000_000,
  lyceens: 2_200_000,
  retraites: 17_000_000,
  agentsPublics: 5_700_000,
};
