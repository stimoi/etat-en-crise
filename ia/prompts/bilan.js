// =====================================================================
// bilan.js — Faire écrire par l'IA le « verdict de l'Histoire » en fin de partie.
// =====================================================================

import { REGLES_CONTENU, decrireJauges, decrireDate, decrireJournal, decrireGrandesReformes } from './commun.js';
import { DETTE_DEPART } from '../../public/donnees-budget.js';

// Comment la partie s'est terminée, en clair pour l'IA.
const CAUSES = {
  dette: 'la dette a atteint le seuil de faillite et les marchés ont paniqué',
  popularite: 'la popularité est tombée à 0',
  economie: 'l\'économie s\'est effondrée (0)',
  ordre: 'l\'ordre public s\'est effondré (0)',
};

const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });

const PROMPT_SYSTEME = `Tu es l'historien officiel, bienveillant mais moqueur, d'un jeu humoristique où le joueur dirige l'État français (version fictive). La partie vient de se terminer. Tu rédiges le verdict de l'Histoire sur ce mandat.

FORMAT DE RÉPONSE — OBLIGATOIRE
- Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après, pas de balises markdown.
- Structure exacte, avec exactement ces noms de champs :
{"titre": "...", "resume": "..."}
- "titre" : le surnom que l'Histoire donnera à ce mandat, 8 mots maximum (exemple : « Le mandat des croissants tièdes »).
- "resume" : 3 à 4 phrases. Cite 2 ou 3 décisions marquantes du journal, évoque l'évolution de la dette, raconte avec humour comment tout s'est terminé, et finis par une chute.
- Le joueur est désigné par « vous ».

${REGLES_CONTENU}`;

export function construirePromptSysteme() {
  return PROMPT_SYSTEME;
}

// demande : { tour, jauges, cause, journal, calendrier, debut, engagements }
export function construireMessage({ tour, jauges, cause, journal, calendrier, debut, engagements = [] }) {
  const periode = debut
    ? `de ${decrireDate(debut).toLowerCase()} à ${decrireDate(calendrier).toLowerCase()}`
    : `jusqu'à ${decrireDate(calendrier).toLowerCase()}`;

  return `Le mandat a duré ${tour} tours (${periode}). Il s'est terminé parce que ${CAUSES[cause]}.
La dette a évolué de ${format.format(jauges.dette - DETTE_DEPART)} milliards d'euros pendant le mandat.
Grandes réformes budgétaires : ${decrireGrandesReformes(jauges, engagements) || 'aucune'}.

Jauges finales :
${decrireJauges(jauges)}

Journal des décisions du joueur :
${decrireJournal(journal)}

Rédige le verdict de l'Histoire, en JSON uniquement.`;
}

export const SCHEMA = {
  type: 'object',
  properties: { titre: { type: 'string' }, resume: { type: 'string' } },
  required: ['titre', 'resume'],
};
