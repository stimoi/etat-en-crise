// =====================================================================
// game.js — La boucle de jeu.
//
// Ce fichier garde l'état de la partie, parle au serveur et applique les
// décisions. Il ne touche jamais au HTML lui-même : il passe par
// affichage.js. Les règles (seuils, calculs, budget) sont dans regles.js.
// =====================================================================

import {
  VALEURS_DEPART, DETTE_MAX,
  resoudreDecision, causeDeFin, niveauDeCrise, choisirDecisionASuivre,
  dateDuTour, libelleDate, libelleMois, budgetDuMois, ratioDettePib,
} from './regles.js';
import * as affichage from './affichage.js';
import { CLE_PARTIE, lire, ecrire, effacer } from './partie.js';
import { appeler } from './serveur.js';

// Nombre de décisions passées envoyées à l'IA à chaque tour : c'est sa « mémoire ».
const TAILLE_MEMOIRE = 8;

// Clé sous laquelle le résultat est confié à la page « Le mur des mandats ».
const CLE_RESULTAT = 'etat-en-crise:resultat-a-publier';

const pourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

// Un message immédiat par cause de défaite (avant le bilan de l'IA).
const MESSAGES_FIN = {
  popularite: 'Votre popularité est passée sous celle du réveil du lundi matin. Le pays vous remercie… de partir.',
  economie: 'L\'économie est à l\'arrêt. Même les tirelires ont déposé le bilan.',
  ordre: 'Plus personne ne respecte rien, pas même la file d\'attente à la boulangerie. C\'est le chaos.',
  dette: `La dette a atteint ${DETTE_MAX} milliards, soit ${pourcent.format(ratioDettePib(DETTE_MAX))} du PIB. Les marchés paniquent : les créanciers ont saisi la tour Eiffel, et la baguette avec.`,
};

// Si l'IA ne peut pas écrire le bilan de fin, on affiche celui-ci.
const BILAN_SECOURS = {
  titre: 'Le mandat dont personne ne parle',
  resume: 'Les historiens sont en grève : aucun bilan officiel ne sera publié. Officieusement, ils disent que vous avez fait de votre mieux. Officieusement.',
};

// Tout l'état de la partie tient dans cet objet.
// Quand on clique sur « Rejouer », on en crée un NOUVEAU : les réponses du
// serveur qui arrivent en retard pour l'ancienne partie sont alors ignorées
// (voir les tests « etat !== partie » plus bas).
let etat = null;

// La date du tour en cours : { annee, mois, periode }.
const calendrier = () => dateDuTour(etat.debut, etat.tour);

// Sauvegarde dans le navigateur : la partie survit au rechargement de la page,
// et la page Discussion peut la lire (et la modifier) dans un autre onglet.
function sauvegarder() {
  const { tour, debut, jauges, engagements, journal, toursDejaSuivis, evenement, sourceEvenement, suiteDe } = etat;
  ecrire(CLE_PARTIE, { tour, debut, jauges, engagements, journal, toursDejaSuivis, evenement, sourceEvenement, suiteDe });
}

// Affiche tout l'état courant (jauges, budget, date...).
function afficherSituation() {
  affichage.afficherJauges(etat.jauges);
  affichage.afficherBudget(budgetDuMois(etat.jauges, etat.engagements), etat.engagements, etat.jauges);
  affichage.afficherTour(etat.tour);
  affichage.afficherDate(libelleDate(calendrier()));
  affichage.afficherNiveauCrise(niveauDeCrise(etat.tour));
}

// Reprend une partie sauvegardée, là où elle s'était arrêtée (même événement).
function reprendrePartie(sauvegarde) {
  const { version, ...donnees } = sauvegarde;
  etat = { ...donnees, suiteDemandee: null, enAttente: false };
  affichage.masquerFin();
  affichage.masquerDecision();
  afficherSituation();

  // Une discussion a pu faire tomber une jauge à 0 pendant l'absence du joueur.
  const cause = causeDeFin(etat.jauges);
  if (cause) {
    terminerPartie(cause);
  } else if (etat.evenement) {
    affichage.afficherEvenement(etat.evenement, etat.sourceEvenement, etat.suiteDe);
  } else {
    chargerEvenement();
  }
}

function demarrerPartie() {
  // La partie commence au mois réel d'aujourd'hui.
  const aujourdhui = new Date();
  etat = {
    tour: 0,
    debut: { annee: aujourdhui.getFullYear(), mois: aujourdhui.getMonth() },
    jauges: { ...VALEURS_DEPART },
    engagements: [], // mesures budgétaires en cours { libelle, poste, montantMensuel, toursRestants }
    journal: [], // toutes les décisions : { tour, titre, choix, personnage, libre }
    toursDejaSuivis: [], // décisions dont la conséquence a déjà été jouée
    suiteDemandee: null, // décision dont on demande la conséquence ce tour-ci
    evenement: null, // l'événement affiché, en attente d'une décision
    enAttente: false, // vrai pendant l'évaluation d'un choix libre
  };
  affichage.masquerFin();
  affichage.masquerDecision();
  affichage.afficherJauges(etat.jauges);
  affichage.afficherBudget(budgetDuMois(etat.jauges, etat.engagements), etat.engagements, etat.jauges);
  nouveauTour();
}

function nouveauTour() {
  etat.tour += 1;
  affichage.afficherTour(etat.tour);
  affichage.afficherDate(libelleDate(calendrier()));
  affichage.afficherNiveauCrise(niveauDeCrise(etat.tour));
  // De temps en temps, ce tour sera la conséquence d'une décision passée.
  etat.suiteDemandee = choisirDecisionASuivre(etat.journal, etat.tour, etat.toursDejaSuivis);
  sauvegarder();
  chargerEvenement();
}

// Séparée de nouveauTour() pour que le bouton « Réessayer » relance
// le chargement sans faire avancer le compteur de tours.
async function chargerEvenement() {
  const partie = etat;
  affichage.afficherChargement(true);
  try {
    const { evenement, source, suiteDe } = await envoyer('/api/evenement', {
      tour: etat.tour,
      jauges: etat.jauges,
      journal: etat.journal.slice(-TAILLE_MEMOIRE),
      suite: etat.suiteDemandee,
      calendrier: calendrier(),
      engagements: etat.engagements,
    });
    if (etat !== partie) return; // une nouvelle partie a commencé entre-temps

    if (suiteDe) etat.toursDejaSuivis.push(suiteDe);
    etat.evenement = evenement;
    etat.sourceEvenement = source;
    etat.suiteDe = suiteDe;
    sauvegarder(); // recharger la page redonnera le MÊME événement (pas de « triche »)
    affichage.afficherEvenement(evenement, source, suiteDe);
  } catch (erreur) {
    // Le serveur renvoie toujours un événement (IA, calendrier ou secours). On n'arrive
    // ici que si le serveur lui-même est injoignable (fenêtre du terminal fermée...).
    console.error(erreur);
    affichage.afficherErreur('Impossible de joindre le serveur du jeu. Est-il toujours lancé dans le terminal ?');
  } finally {
    affichage.afficherChargement(false);
  }
}

// Clic sur une des 3 propositions.
function choisir(index) {
  const choix = etat.evenement?.choix[index];
  if (!choix || etat.enAttente) return;
  appliquerDecision({ texte: choix.texte, effets: choix.effets, budget: choix.budget ?? null, reaction: null, libre: false });
}

// Le joueur a écrit sa propre décision : l'IA en évalue les effets et le coût.
async function proposerChoixLibre(texteSaisi) {
  const proposition = texteSaisi.trim();
  if (!etat.evenement || etat.enAttente) return;
  if (!proposition) {
    affichage.afficherMessageChoixLibre('Écrivez d\'abord votre décision.');
    return;
  }

  const partie = etat;
  const evenement = etat.evenement;
  etat.enAttente = true;
  affichage.afficherMessageChoixLibre('');
  affichage.bloquerChoix(true);

  try {
    const resultat = await envoyer('/api/choix-libre', {
      tour: etat.tour,
      jauges: etat.jauges,
      calendrier: calendrier(),
      engagements: etat.engagements,
      evenement: {
        titre: evenement.titre,
        description: evenement.description,
        choix: evenement.choix.map((c) => c.texte),
      },
      proposition,
    });
    if (etat !== partie) return;

    etat.enAttente = false;
    if (!resultat.acceptable) {
      // Proposition refusée : on explique pourquoi, et l'événement reste jouable.
      affichage.afficherMessageChoixLibre(`🙅 ${resultat.reaction}`);
      affichage.bloquerChoix(false);
      return;
    }
    appliquerDecision({
      texte: resultat.texte,
      effets: resultat.effets,
      budget: resultat.budget ?? null,
      reaction: resultat.reaction,
      libre: true,
    });
  } catch (erreur) {
    if (etat !== partie) return;
    // IA indisponible : rien n'est perdu, le joueur peut réessayer ou cliquer un choix.
    etat.enAttente = false;
    affichage.afficherMessageChoixLibre(erreur.message);
    affichage.bloquerChoix(false);
  }
}

// Commun aux deux façons de décider (proposition ou idée libre).
function appliquerDecision({ texte, effets, budget, reaction, libre }) {
  const evenement = etat.evenement;
  // On « consomme » l'événement tout de suite : un double clic rapide
  // ne peut pas appliquer deux fois les effets.
  etat.evenement = null;

  // regles.js applique les effets et le budget de la décision TOUT DE SUITE,
  // puis fait avancer le temps d'un tiers de mois.
  const resultat = resoudreDecision(
    { jauges: etat.jauges, engagements: etat.engagements },
    { texte, effets, budget },
    etat.tour,
  );
  etat.jauges = resultat.jauges;
  etat.engagements = resultat.engagements;

  etat.journal.push({
    tour: etat.tour,
    titre: evenement.titre,
    choix: texte,
    personnage: evenement.personnage?.id ?? null,
    libre,
  });

  affichage.afficherJauges(etat.jauges);
  affichage.animerVariations(resultat.variations);
  // C'est seulement maintenant que le joueur découvre ce que sa décision a changé.
  affichage.afficherDecision({ texte, reaction, libre, budgetDecision: budget, ...resultat });
  affichage.afficherBudget(budgetDuMois(etat.jauges, etat.engagements), etat.engagements, etat.jauges);
  sauvegarder();

  const cause = causeDeFin(etat.jauges);
  if (cause) {
    terminerPartie(cause);
  } else {
    nouveauTour();
  }
}

async function terminerPartie(cause) {
  const partie = etat;
  effacer(CLE_PARTIE); // partie finie : plus rien à reprendre
  affichage.afficherFin(etat.tour, MESSAGES_FIN[cause], libelleDate(calendrier()));
  affichage.afficherChargementBilan(true);

  let bilan;
  try {
    bilan = await envoyer('/api/bilan', {
      tour: etat.tour,
      jauges: etat.jauges,
      cause,
      journal: etat.journal.slice(-30), // le serveur n'en garde pas plus de toute façon
      calendrier: calendrier(),
      debut: etat.debut,
      engagements: etat.engagements, // pour que l'Histoire cite vos grandes réformes
    });
  } catch {
    bilan = BILAN_SECOURS;
  }

  if (etat !== partie) return; // le joueur a déjà relancé une partie
  etat.fin = { cause, bilan }; // gardé pour une éventuelle publication sur le mur
  affichage.afficherChargementBilan(false);
  affichage.afficherBilan(bilan);
}

// « Publier sur le mur des mandats » : on confie le résultat à la page du mur
// (stockage de l'onglet, qui survit à l'aller-retour vers la connexion Discord).
function publierResultat() {
  if (!etat.fin) return;
  const fin = dateDuTour(etat.debut, etat.tour);
  const formatPourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 });

  // Les 3 lignes du budget les plus modifiées par le joueur (« Santé −90 % »).
  const budget = budgetDuMois(etat.jauges, etat.engagements);
  const reformes = [...budget.lignesDepenses, ...budget.lignesRecettes]
    .filter((ligne) => ligne.base && Math.abs(ligne.effectif - ligne.base) / ligne.base >= 0.05)
    .sort((a, b) => Math.abs(b.effectif - b.base) - Math.abs(a.effectif - a.base))
    .slice(0, 3)
    .map((ligne) => `${ligne.libelle} ${formatPourcent.format((ligne.effectif - ligne.base) / ligne.base)}`);

  const resultat = {
    titre: etat.fin.bilan.titre,
    resume: etat.fin.bilan.resume,
    tours: etat.tour - 1,
    cause: etat.fin.cause,
    dette: etat.jauges.dette,
    periode: `${libelleMois(etat.debut)} → ${libelleMois(fin)}`,
    reformes,
  };
  try {
    sessionStorage.setItem(CLE_RESULTAT, JSON.stringify(resultat));
  } catch {
    // stockage bloqué (navigation privée stricte) : la page du mur l'indiquera
  }
  location.href = 'resultats.html#publier';
}

// Envoie du JSON au serveur et renvoie sa réponse.
// En cas d'erreur, on remonte le message du serveur s'il en a donné un.
async function envoyer(url, corps) {
  const reponse = await appeler(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error(donnees.erreur ?? `Le serveur a répondu ${reponse.status}`);
  }
  return donnees;
}

affichage.brancherBoutons({
  onChoix: choisir,
  onChoixLibre: proposerChoixLibre,
  onReessayer: chargerEvenement,
  onRejouer: demarrerPartie,
  onPublier: publierResultat,
  onNouvellePartie: () => {
    if (confirm('Abandonner la partie en cours et en commencer une nouvelle ?')) demarrerPartie();
  },
});

// Une décision prise sur la page Discussion (dans un autre onglet) a modifié
// la partie : on récupère les nouvelles jauges et mesures, sans toucher à l'événement affiché.
window.addEventListener('storage', (evenement) => {
  if (evenement.key !== CLE_PARTIE || !etat || etat.fin) return;
  const sauvegarde = lire(CLE_PARTIE);
  if (!sauvegarde || sauvegarde.tour !== etat.tour) return;
  etat.jauges = sauvegarde.jauges;
  etat.engagements = sauvegarde.engagements;
  etat.journal = sauvegarde.journal;
  afficherSituation();
  const cause = causeDeFin(etat.jauges);
  if (cause) terminerPartie(cause);
});

// Au chargement : on reprend la partie en cours s'il y en a une.
const sauvegarde = lire(CLE_PARTIE);
if (sauvegarde) reprendrePartie(sauvegarde);
else demarrerPartie();
