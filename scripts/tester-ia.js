// =====================================================================
// tester-ia.js — « npm run tester-ia »
//
// Envoie UNE vraie demande d'événement à l'IA (comme au premier tour d'une
// partie) et affiche le résultat, le temps de réponse et le budget de chaque
// choix. Pratique pour vérifier la connexion à l'IA sans lancer le jeu,
// ou pour comparer deux modèles (change CRAFTPICK_MODELE dans .env).
// =====================================================================

import path from 'node:path';
import { demanderJsonIA } from '../ia/craftpickClient.js';
import * as promptEvenement from '../ia/prompts/evenement.js';
import { validerEvenement } from '../ia/validation.js';
import { nettoyerDemandeEvenement } from '../ia/nettoyage.js';
import { VALEURS_DEPART } from '../public/regles.js';

try {
  process.loadEnvFile(path.join(import.meta.dirname, '..', '.env'));
} catch {
  console.error('❌ Pas de fichier .env : copie .env.example en .env et remplis-le.');
  process.exit(1);
}

console.log(`🤖 Modèle : ${process.env.CRAFTPICK_MODELE}`);
console.log('⏳ Demande d\'un événement…');

const demande = nettoyerDemandeEvenement({ tour: 1, jauges: VALEURS_DEPART });
const debut = Date.now();

try {
  const reponse = await demanderJsonIA(
    promptEvenement.construirePromptSysteme(),
    promptEvenement.construireMessage(demande),
    promptEvenement.SCHEMA,
  );
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  const evenement = validerEvenement(reponse);

  console.log(`✅ Réponse valide en ${duree} s\n`);
  console.log(`📰 ${evenement.titre}${evenement.personnage ? ` (avec « ${evenement.personnage} »)` : ''}`);
  console.log(`   ${evenement.description}\n`);
  evenement.choix.forEach((choix, i) => {
    const budget = choix.budget
      ? `${choix.budget.montantMensuel} Md€/mois × ${choix.budget.dureeMois} mois (${choix.budget.poste})${choix.budget.calcul ? ` — ${choix.budget.calcul}` : ''}`
      : 'sans impact budgétaire';
    console.log(`   ${'ABC'[i]}. ${choix.texte}`);
    console.log(`      budget : ${budget} · effets : ${JSON.stringify(choix.effets)}`);
  });
} catch (erreur) {
  console.error(`❌ Échec après ${((Date.now() - debut) / 1000).toFixed(1)} s : ${erreur.message}`);
  console.error('   (En jeu, un événement de secours aurait été utilisé.)');
  process.exitCode = 1;
}
