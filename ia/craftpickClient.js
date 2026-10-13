// =====================================================================
// craftpickClient.js — LE SEUL fichier qui parle à l'IA.
//
// L'IA est un serveur Ollama : on utilise sa route POST /api/chat
// (doc : https://docs.ollama.com/api/chat).
// Le reste du jeu ne connaît qu'une seule fonction : demanderJsonIA().
// Si demain tu changes d'IA, c'est le seul fichier à réécrire.
// =====================================================================

// Au-delà de ce délai, on abandonne l'appel : le joueur ne doit pas attendre
// indéfiniment. (Mesuré : environ 5 à 6 secondes avec gemma4:31b-cloud.)
const DELAI_MAX_MS = 15000;

/**
 * Envoie un prompt à l'IA et renvoie le texte généré (censé contenir du JSON).
 * Lève une erreur en cas de problème : c'est le serveur qui décide quoi faire.
 *
 * schema : description JSON Schema de la réponse attendue. ATTENTION : testé
 * avec gemma4:31b-cloud, le modèle l'IGNORE (il renvoie parfois d'autres noms
 * de champs, entourés de ```). On l'envoie quand même car les modèles installés
 * en local le respectent, mais la vraie protection reste le prompt (qui décrit
 * le format exact) et la validation (validation.js).
 */
export async function demanderJsonIA(promptSysteme, messageUtilisateur, schema, { longueurMax = 1000 } = {}) {
  // Lus depuis le fichier .env, côté serveur uniquement :
  // le navigateur ne connaît jamais l'adresse de l'IA.
  const url = process.env.CRAFTPICK_API_URL;
  const modele = process.env.CRAFTPICK_MODELE;
  if (!url || !modele) {
    throw new Error('CRAFTPICK_API_URL ou CRAFTPICK_MODELE est vide dans le fichier .env');
  }

  const reponse = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: construireEntetes(),
    body: JSON.stringify({
      model: modele,
      messages: [
        { role: 'system', content: promptSysteme },
        { role: 'user', content: messageUtilisateur },
      ],
      stream: false, // on veut la réponse complète d'un coup, pas mot par mot
      think: false, // pas de « réflexion » préalable : réponse plus rapide
      format: schema,
      options: {
        temperature: 0.9, // un peu de fantaisie pour varier les textes
        // Nombre maximum de « morceaux de mots » générés : évite qu'un modèle
        // bavard ne fasse attendre le joueur (un événement en utilise ≈ 400).
        num_predict: longueurMax,
      },
    }),
    // Coupe l'appel s'il est trop long (l'erreur est rattrapée par le serveur).
    signal: AbortSignal.timeout(DELAI_MAX_MS),
  });

  if (!reponse.ok) {
    // On garde un extrait du message d'erreur pour t'aider à déboguer dans le terminal
    // (ex. 404 = modèle introuvable sur le serveur).
    const detail = (await reponse.text()).slice(0, 300);
    throw new Error(`L'IA a répondu ${reponse.status} : ${detail}`);
  }

  const donnees = await reponse.json();
  // Réponse d'Ollama : { model, message: { role, content }, done, ... }
  // Le texte généré par le modèle est dans message.content.
  const texte = donnees?.message?.content;
  if (typeof texte !== 'string' || texte.trim() === '') {
    throw new Error('Réponse de l\'IA sans contenu (message.content vide)');
  }
  return texte;
}

function construireEntetes() {
  const entetes = { 'Content-Type': 'application/json' };
  // Un serveur Ollama classique ne demande pas de clé. Si un jour tu passes
  // par un serveur qui en exige une (comme l'API d'ollama.com), mets-la dans
  // CRAFTPICK_API_KEY : elle sera envoyée ici, et seulement ici.
  if (process.env.CRAFTPICK_API_KEY) {
    entetes.Authorization = `Bearer ${process.env.CRAFTPICK_API_KEY}`;
  }
  return entetes;
}

/**
 * Conversation libre (page « Discussion ») : renvoie la réponse de l'IA
 * MORCEAU PAR MORCEAU, au fur et à mesure qu'elle l'écrit (« streaming »).
 * C'est un « générateur » : on le lit avec  for await (const morceau of discuterIA(...)).
 *
 * messages : [{ role: 'system' | 'user' | 'assistant', content: '...' }]
 */
export async function* discuterIA(messages, { longueurMax = 700 } = {}) {
  const url = process.env.CRAFTPICK_API_URL;
  const modele = process.env.CRAFTPICK_MODELE;
  if (!url || !modele) {
    throw new Error('CRAFTPICK_API_URL ou CRAFTPICK_MODELE est vide dans le fichier .env');
  }

  const reponse = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: construireEntetes(),
    body: JSON.stringify({
      model: modele,
      messages,
      stream: true, // Ollama envoie une ligne JSON par morceau de texte
      think: false,
      options: { temperature: 0.8, num_predict: longueurMax },
    }),
    // Plus long que pour un événement : une réponse peut s'écrire pendant un moment.
    signal: AbortSignal.timeout(60000),
  });
  if (!reponse.ok) {
    throw new Error(`L'IA a répondu ${reponse.status} : ${(await reponse.text()).slice(0, 300)}`);
  }

  // Chaque ligne reçue : {"message": {"content": "un bout de texte"}, "done": false}
  let reste = '';
  for await (const bloc of reponse.body.pipeThrough(new TextDecoderStream())) {
    reste += bloc;
    const lignes = reste.split('\n');
    reste = lignes.pop(); // la dernière ligne est peut-être incomplète : on la garde
    for (const ligne of lignes) {
      if (!ligne.trim()) continue;
      const donnees = JSON.parse(ligne);
      if (donnees.error) throw new Error(donnees.error);
      if (donnees.message?.content) yield donnees.message.content;
      if (donnees.done) return;
    }
  }
}
