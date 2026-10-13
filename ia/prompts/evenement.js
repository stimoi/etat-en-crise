// =====================================================================
// evenement.js — Demander à l'IA l'événement du tour.
//
// Deux parties :
//  - le prompt SYSTÈME : les règles fixes (format, équilibre, budget, personnages) ;
//  - le message : ce qui change à chaque tour (date, jauges, budget, journal...).
// =====================================================================

import {
  REGLES_CONTENU, SENS_DES_EFFETS, REPERES_BUDGET, FORMAT_EFFETS, FORMAT_BUDGET, LISTE_PERSONNAGES,
  SCHEMA_EFFETS, SCHEMA_BUDGET, decrireJauges, decrireBudget, decrireDate, decrireJournal,
} from './commun.js';

const PROMPT_SYSTEME = `Tu es le moteur d'événements d'un jeu humoristique où le joueur dirige l'État français (version fictive). Un tour dure un tiers de mois (début, mi-, fin de mois). À chaque tour, tu inventes UN événement (crise, problème ou opportunité) avec exactement 3 choix.

FORMAT DE RÉPONSE — OBLIGATOIRE
- Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après, pas de balises markdown, pas de commentaires.
- Structure exacte, avec exactement ces noms de champs :
{"titre": "...", "description": "...", "personnage": "aucun", "choix": [{"texte": "...", "effets": ${FORMAT_EFFETS}, "budget": ${FORMAT_BUDGET}}, {...}, {...}]}
- "personnage" : l'identifiant d'un personnage récurrent (liste plus bas) s'il intervient dans l'événement, sinon "aucun".

${SENS_DES_EFFETS}

${REPERES_BUDGET}

ÉQUILIBRE
- Chaque choix a au moins un avantage ET au moins un coût (une jauge en baisse, ou une mesure qui creuse le déficit). Aucun choix parfait, aucun choix totalement catastrophique.
- Les 3 choix sont vraiment différents : en général un choix coûteux, un choix économe, un choix sans impact budgétaire.
- Tiens compte de l'état des jauges et du budget : si une jauge est basse, crée une situation qui la met sous tension ou qui offre une chance risquée de la remonter. Si le déficit est élevé, propose aussi des occasions d'économiser.
- Tiens compte de la date (saison, période de l'année).
- Ne reprends pas les thèmes du journal des décisions (sauf si on te demande explicitement une conséquence).

SITUATIONS
- Concrètes et variées : budget et dette, lycéens et éducation (grève, bac, cantine, orientation), météo (canicule, inondation), pénuries, transports, numérique, santé, culture, sport, agriculture, etc.

PERSONNAGES RÉCURRENTS (fictifs)
${LISTE_PERSONNAGES}
- Le message de chaque tour t'indique si tu dois faire intervenir un personnage. Si oui, nomme-le dans la description et garde son caractère d'un tour à l'autre. Si non, ne nomme AUCUN d'eux et mets "personnage": "aucun".
- Ils se souviennent des décisions du journal et peuvent y faire référence (rancune, gratitude, « je vous l'avais bien dit »).

${REGLES_CONTENU}

LONGUEURS
- "titre" : 8 mots maximum.
- "description" : 2 phrases maximum.
- "texte" de chaque choix : 12 mots maximum, commence par un verbe d'action.`;

export function construirePromptSysteme() {
  return PROMPT_SYSTEME;
}

// Testé : avec le même début de partie, l'IA propose souvent le même thème
// (deux crises de stylos d'affilée...). Le serveur tire donc un thème au sort.
const THEMES = [
  'santé et hôpitaux', 'transports et trains', 'agriculture et alimentation', 'numérique et internet',
  'culture et patrimoine', 'sport', 'énergie et électricité', 'logement', 'météo et climat',
  'sécurité et police', 'lycées et lycéens', 'environnement et nature', 'tourisme', 'industrie et emploi',
  'impôts et taxes', 'administration et paperasse', 'espace et recherche', 'défense et armée',
];

export function tirerTheme(hasard = Math.random) {
  return THEMES[Math.floor(hasard() * THEMES.length)];
}

// demande : { tour, jauges, journal, suite, calendrier, engagements } (déjà nettoyée par le serveur)
export function construireMessage({ tour, jauges, journal, suite, calendrier, engagements }) {
  // Événement en chaîne : on demande explicitement une conséquence d'une décision passée.
  // Sinon, un thème tiré au sort pour varier les événements.
  const consigneSuite = suite
    ? `\n\nIMPORTANT — CE TOUR EST UNE CONSÉQUENCE : invente un événement qui découle directement (et de façon inattendue) de la décision du tour ${suite.tour} : « ${suite.titre} » → « ${suite.choix} ». La description doit rappeler clairement ce lien.`
    : `\n\nTHÈME IMPOSÉ pour ce tour : ${tirerTheme()}. Le sujet doit être différent de tous ceux du journal.`;

  // Testé : laissée libre, l'IA met un personnage dans CHAQUE événement.
  // C'est donc le code qui décide : un personnage, puis un tour sans, etc.
  const dernierAvaitUnPersonnage = Boolean(journal.at(-1)?.personnage);
  const consignePersonnage = dernierAvaitUnPersonnage
    ? 'PERSONNAGE : ce tour, n\'utilise AUCUN personnage récurrent ("personnage": "aucun").'
    : 'PERSONNAGE : ce tour, fais intervenir le personnage récurrent le plus adapté à la situation.';

  return `Tour n° ${tour} — ${decrireDate(calendrier)}.

État actuel des jauges :
${decrireJauges(jauges)}

${decrireBudget(jauges, engagements)}

Journal des dernières décisions du joueur (du plus ancien au plus récent) :
${decrireJournal(journal)}

${consignePersonnage}${consigneSuite}

Génère l'événement de ce tour, en JSON uniquement.`;
}

export const SCHEMA = {
  type: 'object',
  properties: {
    titre: { type: 'string' },
    description: { type: 'string' },
    personnage: { type: 'string' },
    choix: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: { texte: { type: 'string' }, effets: SCHEMA_EFFETS, budget: SCHEMA_BUDGET },
        required: ['texte', 'effets', 'budget'],
      },
    },
  },
  required: ['titre', 'description', 'personnage', 'choix'],
};
