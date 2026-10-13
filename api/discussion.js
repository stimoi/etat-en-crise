// =====================================================================
// api/discussion.js — Le cœur des routes de la page « Discussion » (sans Express).
//  themes()                 → la liste des thèmes
//  discuter(corps, cle)     → la réponse de l'IA, morceau par morceau
//  decision(corps)          → le joueur vient-il de prendre une décision ?
// =====================================================================

import { discuterIA, demanderJsonIA } from '../ia/craftpickClient.js';
import { THEMES_PUBLICS, promptDuTheme, trouverTheme, bougeLeBudget } from '../ia/prompts/discussion.js';
import * as promptDecision from '../ia/prompts/decision-discussion.js';
import { validerDecisionDiscussion } from '../ia/validation.js';
import { nettoyerSituation } from '../ia/nettoyage.js';
import { ok, erreur, texte, limiter } from './outils.js';

const MAX_MESSAGES = 20; // on n'envoie à l'IA que la fin de la conversation : plus rapide
const MAX_LONGUEUR = 1000;

// Les messages envoyés par le navigateur, nettoyés.
function nettoyerMessages(liste, nombreMax) {
  return (Array.isArray(liste) ? liste : [])
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .slice(-nombreMax)
    .map((m) => ({ role: m.role, content: texte(m.content, MAX_LONGUEUR) }))
    .filter((m) => m.content);
}

export function themes() {
  return ok({ themes: THEMES_PUBLICS });
}

/**
 * Reçoit : { theme, messages: [{ role: 'user' | 'assistant', content }], situation? }
 * Renvoie soit une erreur { statut, json }, soit { statut: 200, flux } où flux est
 * un « itérateur » qui donne la réponse de l'IA morceau par morceau.
 * cle : qui demande (pour l'anti-spam).
 */
export async function discuter(corps, cle) {
  const tropVite = limiter('discuter', cle, 1000);
  if (tropVite) return tropVite;
  const messages = nettoyerMessages(corps?.messages, MAX_MESSAGES);
  if (messages.at(-1)?.role !== 'user') return erreur(400, 'Écris un message d\'abord.');

  const situation = nettoyerSituation(corps?.situation);
  const reponse = discuterIA([{ role: 'system', content: promptDuTheme(corps?.theme, situation) }, ...messages]);

  // On attend le PREMIER morceau avant de répondre : si l'IA est en panne,
  // on peut encore renvoyer une vraie erreur (code 503) au lieu d'un texte vide.
  let premier;
  try {
    premier = await reponse.next();
  } catch (probleme) {
    console.warn(`[Discussion] IA indisponible : ${probleme.message}`);
    return erreur(503, 'L\'IA ne répond pas pour le moment. Réessaie dans un instant.');
  }

  async function* flux() {
    try {
      if (!premier.done) yield premier.value;
      for await (const morceau of reponse) yield morceau;
    } catch (probleme) {
      console.warn(`[Discussion] Réponse interrompue : ${probleme.message}`);
      yield '\n\n[La réponse a été interrompue.]';
    }
  }
  return { statut: 200, flux: flux() };
}

// Reçoit : { theme, messages (la fin de la conversation), situation: { tour, jauges, engagements } }
// Répond : { decision: null }  ou  { decision: { texte, effets, budget } }
export async function decision(corps) {
  const theme = trouverTheme(corps?.theme);
  const messages = nettoyerMessages(corps?.messages, 6);
  const situation = nettoyerSituation(corps?.situation);
  if (!bougeLeBudget(theme.id) || !situation || messages.at(-1)?.role !== 'user') {
    return ok({ decision: null });
  }

  try {
    const reponseIA = await demanderJsonIA(
      promptDecision.construirePromptSysteme(),
      promptDecision.construireMessage({ themeTitre: theme.titre, messages, situation }),
      promptDecision.SCHEMA,
      { longueurMax: 500 },
    );
    return ok({ decision: validerDecisionDiscussion(reponseIA) });
  } catch (probleme) {
    // L'arbitre n'a pas pu trancher : on ne touche à rien (mieux vaut rater une
    // décision que d'en inventer une).
    console.warn(`[Discussion] Décision non analysée : ${probleme.message}`);
    return ok({ decision: null, indisponible: true });
  }
}
