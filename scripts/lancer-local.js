// =====================================================================
// lancer-local.js — « npm run local »
//
// Lance le jeu avec Ollama installé SUR CE PC :
//  1. vérifie qu'Ollama est installé ;
//  2. démarre le serveur Ollama s'il ne tourne pas déjà (« ollama serve ») ;
//  3. télécharge le modèle s'il manque (« ollama pull ») ;
//  4. vérifie que le modèle répond vraiment ;
//  5. lance le jeu en le branchant sur cette IA locale.
//
// Modèle par défaut : gemma4:31b-cloud. Pour en essayer un autre :
//   npm run local -- llama3.2
// ou mets OLLAMA_LOCAL_MODELE=... dans le fichier .env.
// Le fichier .env n'est pas modifié : ces réglages ne valent que pour ce lancement.
// =====================================================================

import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  RACINE, serveurRepond, attendreServeur, listerModeles, testerModele, executer, lancerJeu,
} from './outils-lancement.js';

// On lit le .env pour les éventuels réglages OLLAMA_LOCAL_… (et le PORT du jeu).
try {
  process.loadEnvFile(path.join(RACINE, '.env'));
} catch {
  // Pas de .env : on utilise les valeurs par défaut ci-dessous.
}

const URL_OLLAMA = process.env.OLLAMA_LOCAL_URL || 'http://localhost:11434';
const MODELE = process.argv[2] || process.env.OLLAMA_LOCAL_MODELE || 'gemma4:31b-cloud';

console.log('\n🏠 Lancement avec l\'IA locale (Ollama sur ce PC)');
console.log(`   Modèle : ${MODELE}\n`);

// 1. Ollama est-il installé ?
if (await executer('ollama', ['--version']) !== 0) {
  console.error('❌ Ollama n\'est pas installé (ou pas trouvé).');
  console.error('   Télécharge-le sur https://ollama.com/download puis relance « npm run local ».');
  process.exit(1);
}

// 2. Le serveur Ollama tourne-t-il ? Sinon, on le démarre nous-mêmes.
//    (Sous Windows, l'application Ollama le lance souvent déjà toute seule.)
let ollamaLanceParNous = null;
if (await serveurRepond(URL_OLLAMA)) {
  console.log('✅ Serveur Ollama déjà démarré.');
} else {
  console.log('⏳ Démarrage du serveur Ollama (« ollama serve »)…');
  ollamaLanceParNous = spawn('ollama', ['serve'], { stdio: 'ignore' });
  if (!await attendreServeur(URL_OLLAMA, 20000)) {
    console.error(`❌ Ollama ne répond pas sur ${URL_OLLAMA} après 20 secondes.`);
    ollamaLanceParNous.kill();
    process.exit(1);
  }
  console.log('✅ Serveur Ollama démarré.');
}

// 3. Le modèle est-il présent ? Sinon, on le télécharge.
//    (Pour un modèle « -cloud », c'est presque instantané : il tourne chez Ollama.)
const modeles = await listerModeles(URL_OLLAMA);
if (!modeles.includes(MODELE)) {
  console.log(`⏳ Téléchargement du modèle ${MODELE} (« ollama pull »)…`);
  if (await executer('ollama', ['pull', MODELE]) !== 0) {
    console.error(`❌ Impossible de télécharger ${MODELE}.`);
    if (MODELE.endsWith('-cloud')) console.error('   Les modèles « -cloud » demandent un compte Ollama : lance « ollama signin », puis réessaie.');
    process.exit(1);
  }
}

// 4. Le modèle répond-il vraiment ?
console.log('⏳ Petit test du modèle…');
const test = await testerModele(URL_OLLAMA, MODELE);
if (test.ok) {
  console.log(`✅ Le modèle répond (${test.duree} s).\n`);
} else {
  console.warn(`⚠️  Le modèle ne répond pas : ${test.raison}`);
  if (MODELE.endsWith('-cloud')) console.warn('   Pour un modèle « -cloud », vérifie que tu es connecté : « ollama signin ».');
  console.warn('   Le jeu démarre quand même, avec les événements écrits à la main.\n');
}

// 5. On lance le jeu, branché sur l'IA locale.
lancerJeu(
  {
    CRAFTPICK_API_URL: URL_OLLAMA,
    CRAFTPICK_MODELE: MODELE,
    CRAFTPICK_API_KEY: '', // pas de clé pour un Ollama local
    NOM_IA: `Ollama local (${MODELE})`,
    MODE_IA: 'local', // la version « fichier unique » est réservée à CraftPick
  },
  // Quand on quitte le jeu, on arrête Ollama SEULEMENT si c'est nous qui l'avions lancé.
  () => ollamaLanceParNous?.kill(),
);
