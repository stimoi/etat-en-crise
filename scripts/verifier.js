// =====================================================================
// verifier.js — « npm run verifier »
//
// Contrôle tout ce qui est écrit à la main, sans lancer le jeu :
//  - les vrais chiffres tombent juste (totaux de l'Insee) ;
//  - les événements de secours et du calendrier sont valides ;
//  - les personnages cités existent ;
//  - le fichier .env est présent et rempli.
// Affiche aussi une petite simulation : quand la faillite arrive si on ne fait rien.
// Code de sortie 1 s'il y a une erreur (pratique pour automatiser).
// =====================================================================

import path from 'node:path';
import { existsSync } from 'node:fs';
import {
  COMPTES_2025, LIGNES_DEPENSES, LIGNES_RECETTES, DETTE_DEPART, PIB, SOURCES, ANCIENS_POSTES, IDS_LIGNES_MODIFIABLES,
} from '../public/donnees-budget.js';
import {
  VALEURS_DEPART, DETTE_MAX, budgetDuMois, resoudreDecision, causeDeFin, dateDuTour, libelleDate,
} from '../public/regles.js';
import { EVENEMENTS_SECOURS } from '../data/evenements-secours.js';
import { EVENEMENTS_SCENARISES } from '../data/evenements-scenarises.js';
import { IDS_PERSONNAGES } from '../data/personnages.js';

const racine = path.join(import.meta.dirname, '..');
const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
let erreurs = 0;

function verifier(condition, message) {
  console.log(`${condition ? '  ✅' : '  ❌'} ${message}`);
  if (!condition) erreurs += 1;
}

const presque = (a, b, tolerance = 0.15) => Math.abs(a - b) <= tolerance;
const somme = (lignes) => lignes.reduce((total, ligne) => total + ligne.montantAn, 0);

console.log('\n📊 Données réelles (toutes administrations publiques)');
const depensesHorsInterets = somme(LIGNES_DEPENSES);
verifier(presque(depensesHorsInterets + COMPTES_2025.interets, COMPTES_2025.depenses), `Dépenses par fonction + intérêts = ${format.format(depensesHorsInterets + COMPTES_2025.interets)} Md€ (Insee 2025 : ${format.format(COMPTES_2025.depenses)})`);
verifier(presque(somme(LIGNES_RECETTES), COMPTES_2025.recettes), `Somme des recettes = ${format.format(somme(LIGNES_RECETTES))} Md€ (Insee 2025 : ${format.format(COMPTES_2025.recettes)})`);
verifier(presque(COMPTES_2025.depenses - COMPTES_2025.recettes, COMPTES_2025.deficit), `Dépenses - recettes = déficit (${format.format(COMPTES_2025.deficit)} Md€)`);
verifier(Object.values(ANCIENS_POSTES).every((id) => IDS_LIGNES_MODIFIABLES.includes(id)), 'Les anciens noms de postes pointent tous vers une vraie ligne');
console.log(`  ℹ️  Dette de départ : ${format.format(DETTE_DEPART)} Md€ · PIB : ${format.format(PIB)} Md€`);

console.log('\n🧪 Finances du jeu au premier mois');
const budget = budgetDuMois(VALEURS_DEPART);
console.log(`  Recettes ${format.format(budget.recettes)} · Dépenses ${format.format(budget.depenses)} (dont intérêts ${format.format(budget.chargeDette)}) · Déficit ${format.format(budget.deficit)} Md€/mois`);
verifier(budget.deficit * 12 > COMPTES_2025.deficit && budget.deficit * 12 < COMPTES_2025.deficit + 10, 'Le déficit annuel du jeu est proche de celui de l\'Insee (intérêts recalculés sur la dette actuelle)');

console.log('\n📰 Événements écrits à la main');
// Importer secours.js valide tous les événements (il lève une erreur sinon).
try {
  const { NOMBRE_SECOURS, MOIS_SCENARISES } = await import('../ia/secours.js');
  verifier(NOMBRE_SECOURS >= 8, `${NOMBRE_SECOURS} événements de secours valides (minimum 8)`);
  const moisManquants = [...Array(12).keys()].map((i) => i + 1).filter((mois) => !MOIS_SCENARISES.includes(mois));
  verifier(moisManquants.length === 0, moisManquants.length ? `Mois sans événement du calendrier : ${moisManquants.join(', ')}` : '12 mois couverts par le calendrier');
} catch (erreur) {
  verifier(false, erreur.message);
}

// La validation ignore un personnage inconnu sans rien dire : ici, on le signale.
for (const evenement of [...EVENEMENTS_SECOURS, ...EVENEMENTS_SCENARISES]) {
  if (evenement.personnage && !IDS_PERSONNAGES.includes(evenement.personnage)) {
    verifier(false, `Personnage inconnu « ${evenement.personnage} » dans « ${evenement.titre} »`);
  }
}
const titres = [...EVENEMENTS_SECOURS, ...EVENEMENTS_SCENARISES].map((e) => e.titre);
verifier(new Set(titres).size === titres.length, 'Aucun titre en double');

console.log('\n🔐 Configuration');
const cheminEnv = path.join(racine, '.env');
if (existsSync(cheminEnv)) {
  process.loadEnvFile(cheminEnv);
  verifier(Boolean(process.env.CRAFTPICK_API_URL), 'CRAFTPICK_API_URL est rempli');
  verifier(Boolean(process.env.CRAFTPICK_MODELE), 'CRAFTPICK_MODELE est rempli');
} else {
  console.log('  ⚠️  Pas de fichier .env : le jeu tournera avec les événements écrits à la main.');
}

console.log('\n⏳ Simulation : si le joueur ne prend aucune mesure');
let situation = { jauges: { ...VALEURS_DEPART }, engagements: [] };
const debut = { annee: new Date().getFullYear(), mois: new Date().getMonth() };
let tour = 1;
for (; tour <= 200; tour += 1) {
  situation = resoudreDecision(situation, { texte: 'Rien', effets: {}, budget: null }, tour);
  if (causeDeFin(situation.jauges) === 'dette') break;
}
console.log(`  Faillite (dette ≥ ${format.format(DETTE_MAX)} Md€) au tour ${tour}, soit ${libelleDate(dateDuTour(debut, tour)).toLowerCase()}.`);

console.log('\n📚 Sources');
SOURCES.forEach((source) => console.log(`  - ${source.libelle} : ${source.url}`));

console.log(erreurs ? `\n❌ ${erreurs} problème(s) trouvé(s).\n` : '\n✅ Tout est en ordre.\n');
process.exitCode = erreurs ? 1 : 0;
