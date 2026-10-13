// Tests des règles du jeu : « npm test »
// (lanceur de tests intégré à Node : aucune dépendance à installer)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALEURS_DEPART, DETTE_MAX, TOURS_PAR_MOIS, budgetDuMois, resoudreDecision, appliquerMesure, causeDeFin,
  dateDuTour, libelleDate, niveauDeCrise, facteurEconomie, choisirDecisionASuivre,
} from '../public/regles.js';
import { COMPTES_2025, DETTE_DEPART, TAUX_APPARENT_DETTE, trouverLigne } from '../public/donnees-budget.js';

const situationDepart = () => ({ jauges: { ...VALEURS_DEPART }, engagements: [] });
const rien = { texte: 'Rien', effets: {}, budget: null };
const presque = (a, b, tolerance = 0.1) => Math.abs(a - b) <= tolerance;

test('la partie démarre avec la vraie dette', () => {
  assert.equal(VALEURS_DEPART.dette, DETTE_DEPART);
});

test('le premier mois retrouve les comptes publics de l\'Insee', () => {
  const budget = budgetDuMois(VALEURS_DEPART);
  assert.ok(presque(budget.recettes * 12, COMPTES_2025.recettes, 0.5));
  // Les dépenses hors intérêts sont celles de 2025 ; les intérêts suivent la dette actuelle.
  const horsInterets = COMPTES_2025.depenses - COMPTES_2025.interets;
  assert.ok(presque(budget.depenses * 12, horsInterets + DETTE_DEPART * TAUX_APPARENT_DETTE, 0.5));
  assert.ok(budget.deficit > 12 && budget.deficit < 14);
});

test('3 tours = 1 mois : la dette monte d\'un tiers du déficit mensuel par tour', () => {
  const deficit = budgetDuMois(VALEURS_DEPART).deficit;
  const { jauges } = resoudreDecision(situationDepart(), rien, 1);
  assert.ok(presque(jauges.dette, DETTE_DEPART + deficit / TOURS_PAR_MOIS));
});

test('une mesure PERMANENTE change le déficit immédiatement et pour toujours', () => {
  // Santé -50 % : 261 Md€/an × 50 % = 130,5 Md€/an d'économies = 10,875 Md€/mois.
  const decision = { texte: 'Supprimer l\'assurance maladie', effets: {}, budget: { type: 'permanent', poste: 'sante', montantMensuel: -10.875, dureeMois: null } };
  let situation = resoudreDecision(situationDepart(), decision, 1);
  assert.ok(presque(situation.budgetAvant.deficit - situation.budget.deficit, 10.875, 0.2));
  assert.equal(situation.engagements[0].toursRestants, null);
  for (let tour = 2; tour <= 40; tour += 1) situation = resoudreDecision(situation, rien, tour);
  assert.equal(situation.engagements.length, 1); // toujours là
  const sante = situation.budget.lignesDepenses.find((ligne) => ligne.id === 'sante');
  assert.ok(presque(sante.effectif, 130.5, 0.1));
});

test('une ligne ne descend jamais sous zéro', () => {
  const supprimer = { texte: 'Supprimer l\'armée', effets: {}, budget: { type: 'permanent', poste: 'defense', montantMensuel: -4.5, dureeMois: null } };
  let situation = resoudreDecision(situationDepart(), supprimer, 1);
  situation = resoudreDecision(situation, { ...supprimer, texte: 'Encore' }, 2);
  const defense = situation.budget.lignesDepenses.find((ligne) => ligne.id === 'defense');
  assert.equal(defense.effectif, 0);
});

test('supprimer une RECETTE creuse le déficit (sens de la ligne)', () => {
  const tva = trouverLigne('tva').montantAn;
  const decision = { texte: 'Supprimer la TVA', effets: {}, budget: { type: 'permanent', poste: 'tva', montantMensuel: tva / 12, dureeMois: null } };
  const resultat = resoudreDecision(situationDepart(), decision, 1);
  assert.ok(presque(resultat.budget.deficit - resultat.budgetAvant.deficit, tva / 12, 0.2));
  assert.equal(resultat.budget.lignesRecettes.find((ligne) => ligne.id === 'tva').effectif, 0);
});

test('une dépense PONCTUELLE tombe tout de suite sur la dette', () => {
  const avec = resoudreDecision(situationDepart(), { texte: 'A', effets: {}, budget: { type: 'ponctuel', poste: 'enseignement', montant: 20 } }, 1);
  const sans = resoudreDecision(situationDepart(), rien, 1);
  assert.ok(presque(avec.jauges.dette - sans.jauges.dette, 20, 0.2));
  assert.equal(avec.engagements.length, 0);
});

test('une mesure TEMPORAIRE s\'arrête à la fin de sa durée', () => {
  const decision = { texte: 'Clim', effets: {}, budget: { type: 'temporaire', poste: 'enseignement', montantMensuel: 0.3, dureeMois: 2 } };
  let situation = resoudreDecision(situationDepart(), decision, 1);
  assert.equal(situation.engagements[0].toursRestants, 2 * TOURS_PAR_MOIS - 1);
  for (let tour = 2; tour <= 5; tour += 1) situation = resoudreDecision(situation, rien, tour);
  assert.equal(situation.engagements.length, 1);
  const dernier = resoudreDecision(situation, rien, 6);
  assert.equal(dernier.engagements.length, 0);
  assert.equal(dernier.termines.length, 1);
});

test('le niveau de crise gonfle les coûts, pas les économies', () => {
  const tour = 20;
  const crise = niveauDeCrise(tour);
  assert.ok(crise > 1);
  const cout = resoudreDecision(situationDepart(), { texte: 'A', effets: {}, budget: { type: 'permanent', poste: 'economie', montantMensuel: 1, dureeMois: null } }, tour);
  const economie = resoudreDecision(situationDepart(), { texte: 'B', effets: {}, budget: { type: 'permanent', poste: 'economie', montantMensuel: -1, dureeMois: null } }, tour);
  assert.equal(cout.nouvelEngagement.montantMensuel, Math.round(crise * 1000) / 1000);
  assert.equal(economie.nouvelEngagement.montantMensuel, -1);
});

test('les impôts rentrent mieux quand l\'économie va bien', () => {
  assert.equal(facteurEconomie(50), 1);
  assert.ok(facteurEconomie(100) > facteurEconomie(0));
});

test('ancien format : un coût "dette" dans les effets est toujours appliqué tout de suite', () => {
  const avec = resoudreDecision(situationDepart(), { texte: 'A', effets: { dette: 20 }, budget: null }, 1);
  const sans = resoudreDecision(situationDepart(), rien, 1);
  assert.ok(presque(avec.jauges.dette - sans.jauges.dette, 20, 0.2));
});

test('ancien format : une mesure sur un ancien poste (« impots ») compte toujours', () => {
  const ancien = { libelle: 'Vieille mesure', poste: 'autres-recettes', montantMensuel: -1, toursRestants: 6 };
  const budget = budgetDuMois(VALEURS_DEPART, [ancien]);
  assert.ok(presque(budgetDuMois(VALEURS_DEPART).deficit - budget.deficit, 1, 0.05));
});

test('fin de partie : dette au seuil ou jauge fatale à 0', () => {
  assert.equal(causeDeFin({ ...VALEURS_DEPART, dette: DETTE_MAX }), 'dette');
  assert.equal(causeDeFin({ ...VALEURS_DEPART, ordre: 0 }), 'ordre');
  assert.equal(causeDeFin({ ...VALEURS_DEPART, education: 0 }), null);
  assert.equal(causeDeFin(VALEURS_DEPART), null);
});

test('calendrier : début, mi-, fin de mois puis mois suivant (et changement d\'année)', () => {
  const debut = { annee: 2026, mois: 11 }; // décembre
  assert.equal(libelleDate(dateDuTour(debut, 1)), 'Début décembre 2026');
  assert.equal(libelleDate(dateDuTour(debut, 2)), 'Mi-décembre 2026');
  assert.equal(libelleDate(dateDuTour(debut, 3)), 'Fin décembre 2026');
  assert.equal(libelleDate(dateDuTour(debut, 4)), 'Début janvier 2027');
});

test('événements en chaîne : jamais deux fois la même décision', () => {
  const journal = [{ tour: 1, titre: 'A', choix: 'x' }];
  const toujours = () => 0; // « hasard » qui dit toujours oui
  assert.equal(choisirDecisionASuivre(journal, 3, [], toujours)?.tour, 1);
  assert.equal(choisirDecisionASuivre(journal, 3, [1], toujours), null);
  assert.equal(choisirDecisionASuivre(journal, 3, [], () => 0.99), null);
});

test("discussion : une décision s'applique tout de suite, SANS faire passer de tour", () => {
  const decision = { texte: 'Recruter des profs', effets: { education: 10, popularite: 5 }, budget: { type: 'permanent', poste: 'enseignement', montantMensuel: 0.05, dureeMois: null } };
  const resultat = appliquerMesure(situationDepart(), decision, 1);
  assert.equal(resultat.jauges.dette, DETTE_DEPART); // pas de déficit ajouté : le temps n'a pas avancé
  assert.equal(resultat.jauges.education, 60);
  assert.equal(resultat.engagements.length, 1);
  assert.ok(presque(resultat.budget.deficit - resultat.budgetAvant.deficit, 0.05, 0.001));
});

test('discussion : une dépense ponctuelle tombe tout de suite sur la dette', () => {
  const resultat = appliquerMesure(situationDepart(), { texte: 'A', effets: {}, budget: { type: 'ponctuel', poste: 'enseignement', montant: 1 } }, 1);
  assert.equal(resultat.jauges.dette, DETTE_DEPART + 1);
  assert.equal(resultat.ponctuel, 1);
});
