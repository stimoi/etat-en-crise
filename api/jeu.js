// =====================================================================
// api/jeu.js — Le cœur des routes du jeu (sans Express).
//  evenement(corps)   → l'événement du tour (toujours valide) ;
//  choixLibre(corps)  → évaluer une décision écrite par le joueur ;
//  bilan(corps)       → le verdict de l'Histoire en fin de partie.
// =====================================================================

import { demanderJsonIA } from '../ia/craftpickClient.js';
import * as promptEvenement from '../ia/prompts/evenement.js';
import * as promptChoixLibre from '../ia/prompts/choix-libre.js';
import * as promptBilan from '../ia/prompts/bilan.js';
import { validerEvenement, validerChoixLibre, validerBilan } from '../ia/validation.js';
import { nettoyerDemandeEvenement, nettoyerDemandeChoixLibre, nettoyerDemandeBilan } from '../ia/nettoyage.js';
import { tirerEvenementSecours, trouverEvenementDuCalendrier } from '../ia/secours.js';
import { personnagePublic } from '../data/personnages.js';
import { ok, erreur } from './outils.js';

// Reçoit : { tour, jauges, journal, suite, calendrier, engagements }
// Répond : { evenement, source: 'ia' | 'secours' | 'calendrier', suiteDe: numéro de tour | null }
export async function evenement(corps) {
  const demande = nettoyerDemandeEvenement(corps);
  const titresRecents = demande.journal.map((decision) => decision.titre);

  // 1. Un rendez-vous du calendrier (rentrée, budget, bac...) passe en priorité :
  //    pas besoin d'appeler l'IA, la réponse est immédiate.
  let resultat = trouverEvenementDuCalendrier(demande.calendrier, titresRecents);
  let source = 'calendrier';

  // 2. Sinon, on demande à l'IA. 3. Si elle échoue : événement de secours.
  if (!resultat) {
    try {
      const reponseIA = await demanderJsonIA(
        promptEvenement.construirePromptSysteme(),
        promptEvenement.construireMessage(demande),
        promptEvenement.SCHEMA,
      );
      resultat = validerEvenement(reponseIA);
      source = 'ia';
    } catch (probleme) {
      // Quoi qu'il arrive (IA en panne, délai dépassé, JSON cassé...), on ne plante pas :
      // on affiche la raison dans le terminal et on prend un événement de secours.
      console.warn(`[Tour ${demande.tour}] IA indisponible → événement de secours. Raison : ${probleme.message}`);
      resultat = tirerEvenementSecours(titresRecents);
      source = 'secours';
    }
  }

  // L'IA ne renvoie que l'identifiant du personnage : on y ajoute nom, rôle, emoji.
  resultat.personnage = personnagePublic(resultat.personnage);

  // Une conséquence n'a été générée que si on l'a demandée ET que l'IA a répondu.
  const suiteDe = source === 'ia' && demande.suite ? demande.suite.tour : null;

  return ok({ evenement: resultat, source, suiteDe });
}

// Reçoit : { tour, jauges, calendrier, engagements, evenement: { titre, description, choix }, proposition }
// Répond : { acceptable, texte, reaction, effets, budget }  ou une erreur 400/503
export async function choixLibre(corps) {
  const demande = nettoyerDemandeChoixLibre(corps);
  if (!demande.proposition) return erreur(400, 'Écrivez une décision avant de la proposer.');

  try {
    const reponseIA = await demanderJsonIA(
      promptChoixLibre.construirePromptSysteme(),
      promptChoixLibre.construireMessage(demande),
      promptChoixLibre.SCHEMA,
      { longueurMax: 600 },
    );
    return ok(validerChoixLibre(reponseIA));
  } catch (probleme) {
    // Ici, pas d'événement de secours possible : seule l'IA peut juger une idée libre.
    // Le joueur garde son événement et peut choisir une des 3 propositions.
    console.warn(`[Tour ${demande.tour}] Choix libre non évalué. Raison : ${probleme.message}`);
    return erreur(503, 'L\'IA n\'a pas pu évaluer votre idée. Réessayez ou choisissez une des 3 propositions.');
  }
}

// Reçoit : { tour, jauges, cause, journal, calendrier, debut, engagements }
// Répond : { titre, resume }  ou une erreur 503
export async function bilan(corps) {
  const demande = nettoyerDemandeBilan(corps);
  try {
    const reponseIA = await demanderJsonIA(
      promptBilan.construirePromptSysteme(),
      promptBilan.construireMessage(demande),
      promptBilan.SCHEMA,
      { longueurMax: 700 },
    );
    return ok(validerBilan(reponseIA));
  } catch (probleme) {
    console.warn(`[Fin de partie] Bilan non généré. Raison : ${probleme.message}`);
    return erreur(503, 'Bilan indisponible');
  }
}
