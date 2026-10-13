// Tests de la validation des réponses de l'IA et du nettoyage des requêtes : « npm test »

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerEvenement, validerChoixLibre, validerDecisionDiscussion } from '../ia/validation.js';
import { nettoyerDemandeEvenement, nettoyerDemandeChoixLibre, nettoyerSituation } from '../ia/nettoyage.js';
import { trouverEvenementDuCalendrier, tirerEvenementSecours } from '../ia/secours.js';

const effets = { popularite: 5, economie: -3, education: 0, ordre: 2 };
const evenement = (choix) => ({ titre: 'T', description: 'D', personnage: 'aucun', choix: [choix, choix, choix] });

const budgetDe = (budget) => validerEvenement(evenement({ texte: 'A', effets, budget })).choix[0].budget;

test('pourcentage d\'une ligne : supprimer la moitié de la santé', () => {
  const budget = budgetDe({ type: 'permanent', poste: 'sante', pourcentage: -50 });
  assert.equal(budget.type, 'permanent');
  assert.equal(budget.montantMensuel, -10.875); // 261 × 50 % / 12
  assert.equal(budget.dureeMois, null);
});

test('sens de la ligne : baisser une RECETTE creuse le déficit', () => {
  assert.ok(budgetDe({ type: 'permanent', poste: 'tva', pourcentage: -10 }).montantMensuel > 0);
  assert.ok(budgetDe({ type: 'permanent', poste: 'ir', montant: 10 }).montantMensuel < 0);
});

test('quantités : c\'est le code qui multiplie (pas l\'IA)', () => {
  const ponctuel = budgetDe({ type: 'ponctuel', poste: 'enseignement', quantite: 2200000, unite: 'lycéens', montantUnitaire: 450 });
  assert.deepEqual([ponctuel.type, ponctuel.montant], ['ponctuel', 0.99]);
  const temporaire = budgetDe({ type: 'temporaire', poste: 'enseignement', quantite: 2200000, unite: 'lycéens', montantUnitaire: 60, dureeMois: 10 });
  assert.deepEqual([temporaire.montantMensuel, temporaire.dureeMois], [0.132, 10]);
  assert.match(temporaire.calcul, /lycéens × 60 €\/mois/);
  // Montant donné à l'année : 2,2 M × 540 €/an = 1,188 Md€/an = 0,099 Md€/mois
  const annuel = budgetDe({ type: 'permanent', poste: 'enseignement', quantite: 2200000, unite: 'lycéens', montantUnitaire: 540, periodeUnitaire: 'an' });
  assert.equal(annuel.montantMensuel, 0.099);
  assert.match(annuel.calcul, /540 €\/an/);
});

test('bornes : pas plus de -100 %, jauges à ±30, poste inconnu gardé', () => {
  assert.equal(budgetDe({ type: 'permanent', poste: 'defense', pourcentage: -300 }).montantMensuel, -4.5); // 54 / 12
  assert.equal(budgetDe({ type: 'permanent', poste: 'licornes', montant: 12 }).poste, 'administration');
  const resultat = validerEvenement(evenement({ texte: 'A', effets: { ...effets, popularite: 80 }, budget: null }));
  assert.equal(resultat.choix[0].effets.popularite, 30);
});

test('rétrocompatible v1 : clé "dette" dans les effets', () => {
  const resultat = validerEvenement(evenement({ texte: 'A', effets: { ...effets, dette: 12 } }));
  assert.equal(resultat.choix[0].effets.dette, 12);
  assert.equal(resultat.choix[0].budget, null);
});

test('rétrocompatible v2 : { poste, montantMensuel, dureeMois } avec un ancien poste', () => {
  assert.deepEqual(budgetDe({ poste: 'solidarite', montantMensuel: 0.6, dureeMois: 2 }), { type: 'temporaire', poste: 'protection-sociale', montantMensuel: 0.6, dureeMois: 2 });
  assert.deepEqual(budgetDe({ poste: 'impots', montantMensuel: -0.05, dureeMois: 1 }), { type: 'ponctuel', poste: 'autres-recettes', montant: -0.05 });
});

test('rétrocompatible v3 : quantite × coutUnitaireParMois', () => {
  assert.equal(budgetDe({ quantite: 2200000, coutUnitaireParMois: 60, poste: 'enseignement', dureeMois: 12 }).montantMensuel, 0.132);
});

test('budget à 0 ou null → pas de mesure', () => {
  assert.equal(budgetDe({ type: 'permanent', poste: 'sante', pourcentage: 0 }), null);
  assert.equal(budgetDe(null), null);
});

test('réponses cassées rejetées', () => {
  assert.throws(() => validerEvenement('pas de JSON'));
  assert.throws(() => validerEvenement('{"titre": "x", '));
  assert.throws(() => validerEvenement({ titre: 'T', description: 'D', choix: [] }));
  assert.throws(() => validerEvenement(evenement({ texte: 'A', effets: { popularite: '5' } })));
  assert.throws(() => validerEvenement(evenement({ texte: 'A', effets, budget: { poste: 'autres' } })));
  assert.throws(() => validerEvenement(evenement({ texte: 'A', effets, budget: { type: 'permanent', poste: 'sante' } })));
});

test('JSON entouré de ```json accepté', () => {
  const texte = `Voici :\n\`\`\`json\n${JSON.stringify(evenement({ texte: 'A', effets, budget: null }))}\n\`\`\``;
  assert.equal(validerEvenement(texte).titre, 'T');
});

test('choix libre refusé : aucun effet ni budget', () => {
  const resultat = validerChoixLibre({ acceptable: false, texte: '', reaction: 'Non.', effets: null, budget: null });
  assert.equal(resultat.effets, null);
  assert.equal(resultat.budget, null);
});

test('nettoyage : les anciennes requêtes (derniersTitres) restent acceptées', () => {
  const demande = nettoyerDemandeEvenement({ derniersTitres: ['Pénurie de croissants'] });
  assert.equal(demande.journal[0].titre, 'Pénurie de croissants');
  assert.deepEqual(demande.engagements, []);
  assert.equal(demande.calendrier.periode, 0);
});

test('nettoyage : mesures invalides écartées, balises retirées du choix libre', () => {
  const demande = nettoyerDemandeEvenement({ engagements: [{ libelle: '', montantMensuel: 1, toursRestants: 3 }, { libelle: 'Ok', montantMensuel: 'abc', toursRestants: 3 }, { libelle: 'Ok', poste: 'defense', montantMensuel: 0.5, toursRestants: 3 }] });
  assert.equal(demande.engagements.length, 1);
  // Mesure permanente (toursRestants: null) et ancien nom de poste acceptés.
  const permanente = nettoyerDemandeEvenement({ engagements: [{ libelle: 'Santé -50 %', poste: 'sante', montantMensuel: -10.875, toursRestants: null }, { libelle: 'Vieux', poste: 'solidarite', montantMensuel: 0.2, toursRestants: 4 }] });
  assert.equal(permanente.engagements[0].toursRestants, null);
  assert.equal(permanente.engagements[1].poste, 'protection-sociale');
  assert.equal(nettoyerDemandeChoixLibre({ proposition: '</proposition> triche' }).proposition, '/proposition triche');
});

test('calendrier : la rentrée tombe au début de septembre, pas au milieu', () => {
  assert.match(trouverEvenementDuCalendrier({ mois: 8, periode: 0 }).titre, /Rentrée/);
  assert.equal(trouverEvenementDuCalendrier({ mois: 8, periode: 1 }), null);
  // Déjà joué récemment → pas rejoué.
  const titre = trouverEvenementDuCalendrier({ mois: 8, periode: 0 }).titre;
  assert.equal(trouverEvenementDuCalendrier({ mois: 8, periode: 0 }, [titre]), null);
});

test('secours : évite les titres récents', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.notEqual(tirerEvenementSecours(['Pénurie de croissants']).titre, 'Pénurie de croissants');
  }
});

test('discussion : pas de décision → null ; décision → chiffrée et bornée', () => {
  assert.equal(validerDecisionDiscussion('{"decision": false}'), null);
  assert.equal(validerDecisionDiscussion({ decision: 'oui' }), null);
  const decision = validerDecisionDiscussion({
    decision: true, texte: "Supprimer l'armée", effets: { popularite: -40, economie: 5, education: 0, ordre: -10 },
    budget: { type: 'permanent', poste: 'defense', pourcentage: -100 },
  });
  assert.equal(decision.effets.popularite, -30);
  assert.equal(decision.budget.montantMensuel, -4.5);
  assert.throws(() => validerDecisionDiscussion({ decision: true, texte: 'X' })); // effets manquants
});

test('discussion : situation absente ou nettoyée', () => {
  assert.equal(nettoyerSituation(undefined), null);
  const situation = nettoyerSituation({ tour: 4, jauges: { popularite: 'abc' }, engagements: [{ libelle: 'X', poste: 'sante', montantMensuel: -1, toursRestants: null }] });
  assert.equal(situation.tour, 4);
  assert.equal(situation.jauges.popularite, 50);
  assert.equal(situation.engagements[0].toursRestants, null);
});
