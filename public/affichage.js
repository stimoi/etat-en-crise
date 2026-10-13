// =====================================================================
// affichage.js — TOUT ce qui touche au HTML est ici, et seulement ici.
//
// game.js ne manipule jamais la page directement : il appelle ces fonctions.
// Pour refaire le design, tu modifies index.html + style.css (et au besoin
// ce fichier), sans toucher à la logique du jeu.
//
// On utilise textContent (et jamais innerHTML) : les textes viennent d'une IA
// ou du joueur, textContent garantit qu'ils s'affichent comme du texte et ne
// peuvent pas injecter de HTML ou de script dans la page.
// =====================================================================

import { estUnCout, ratioDettePib, DETTE_MAX, DETTE_ECHELLE_MIN, TOURS_PAR_MOIS } from './regles.js';
import { LIGNES_DEPENSES, LIGNES_RECETTES, LIGNE_INTERETS, SOURCES, trouverLigne } from './donnees-budget.js';

// Optimisation : on cherche chaque élément UNE seule fois au chargement,
// au lieu de le rechercher dans la page à chaque tour.
const element = (id) => document.getElementById(id);
const el = Object.fromEntries([
  'tour', 'date-jeu', 'niveau-crise',
  'derniere-decision', 'decision-texte', 'decision-reaction', 'decision-effets', 'decision-budget', 'decision-fins',
  'chargement', 'evenement', 'evenement-suite', 'evenement-personnage', 'evenement-titre', 'evenement-description', 'evenement-source',
  'form-choix-libre', 'choix-libre', 'bouton-choix-libre', 'choix-libre-message',
  'erreur', 'erreur-message', 'bouton-reessayer',
  'budget-recettes', 'budget-depenses', 'budget-deficit', 'budget-ratio', 'budget-postes', 'budget-lignes-recettes',
  'budget-mesures', 'budget-mesures-vide', 'budget-mesures-total', 'lien-insee', 'lien-fonctions',
  'ecran-fin', 'fin-tours', 'fin-message', 'fin-bilan-chargement', 'fin-bilan-titre', 'fin-bilan-resume', 'bouton-rejouer', 'bouton-publier', 'bouton-nouvelle-partie',
].map((id) => [id, element(id)]));
const boutonsChoix = [...document.querySelectorAll('.bouton-choix')];
const blocsJauges = [...document.querySelectorAll('[data-jauge]')].map((bloc) => ({
  nom: bloc.dataset.jauge,
  bloc,
  libelle: bloc.querySelector('.jauge-nom').textContent, // le libellé vient du HTML
  valeur: bloc.querySelector('.jauge-valeur'),
  remplissage: bloc.querySelector('.jauge-remplissage'),
  variation: bloc.querySelector('.jauge-variation'),
}));

// Formats de nombres « à la française » : 3 595,5 ; +0,25 ; 119,0 %.
const formatEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const formatMd = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const formatMd1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatVariation = new Intl.NumberFormat('fr-FR', { signDisplay: 'exceptZero', maximumFractionDigits: 1 });
const formatSigne = new Intl.NumberFormat('fr-FR', { signDisplay: 'exceptZero', maximumFractionDigits: 2 });
const formatPourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatEcart = new Intl.NumberFormat('fr-FR', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 });
const formatCrise = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

// Liens des sources (définis dans donnees-budget.js, pour ne les écrire qu'une fois).
el['lien-insee'].href = SOURCES[0].url;
el['lien-fonctions'].href = SOURCES[1].url;

// Montant lisible : en millions d'euros sous 0,1 Md€ (« 4 M€ »), en milliards au-dessus.
// signe = true pour afficher « + » / « − ».
function formatMontant(milliards, signe = false) {
  const enMillions = Math.abs(milliards) < 0.1;
  const valeur = enMillions ? Math.round(milliards * 1000) : milliards;
  const nombre = signe ? formatSigne.format(valeur) : formatMd.format(valeur);
  return `${nombre} ${enMillions ? 'M€' : 'Md€'}`;
}

// Durée d'une mesure : « permanent », « encore 3 mois », « encore 2 tours ».
function decrireReste(toursRestants) {
  if (toursRestants === null) return 'permanent';
  if (toursRestants < TOURS_PAR_MOIS) return `encore ${toursRestants} tour${toursRestants > 1 ? 's' : ''}`;
  return `encore ${Math.ceil(toursRestants / TOURS_PAR_MOIS)} mois`;
}

// ---------------------------------------------------------------------
// En-tête et jauges
// ---------------------------------------------------------------------

export function afficherTour(numero) {
  el.tour.textContent = numero;
}

export function afficherDate(libelle) {
  el['date-jeu'].textContent = libelle;
}

export function afficherNiveauCrise(niveau) {
  el['niveau-crise'].textContent = `×${formatCrise.format(niveau)}`;
}

export function afficherJauges(jauges) {
  for (const { nom, bloc, valeur, remplissage } of blocsJauges) {
    const montant = jauges[nom];
    let pourcentage;
    let enDanger;

    if (nom === 'dette') {
      valeur.textContent = `${formatEntier.format(montant)} / ${formatEntier.format(DETTE_MAX)} Md€`;
      // La barre va du bas de l'échelle jusqu'au seuil de faillite.
      pourcentage = ((montant - DETTE_ECHELLE_MIN) / (DETTE_MAX - DETTE_ECHELLE_MIN)) * 100;
      enDanger = pourcentage >= 85;
    } else {
      valeur.textContent = `${montant} / 100`;
      pourcentage = montant;
      enDanger = montant <= 20;
    }

    // La transition CSS sur "width" fait glisser la barre.
    remplissage.style.width = `${Math.min(100, Math.max(0, pourcentage))}%`;
    // Classe "danger" quand on approche de la défaite (le CSS décide du rendu).
    bloc.classList.toggle('danger', enDanger);
  }
}

// Fait apparaître « +8 » / « −5 » à côté des jauges qui ont bougé.
export function animerVariations(variations) {
  for (const { nom, variation: zone } of blocsJauges) {
    const variation = variations[nom];
    zone.classList.remove('animer', 'effet-bon', 'effet-mauvais');
    if (!variation) {
      zone.textContent = '';
      continue;
    }
    zone.textContent = formatVariation.format(variation);
    zone.classList.add(estUnCout(nom, variation) ? 'effet-mauvais' : 'effet-bon');
    // Astuce : lire offsetWidth force le navigateur à « oublier » l'ancienne
    // animation, sinon elle ne se rejoue pas deux tours de suite.
    void zone.offsetWidth;
    zone.classList.add('animer');
  }
}

// ---------------------------------------------------------------------
// Dernière décision : c'est SEULEMENT ICI, après le choix, que le joueur
// découvre ce que sa décision a coûté ou rapporté.
// ---------------------------------------------------------------------

// Phrase décrivant l'effet budgétaire, appliqué immédiatement.
function decrireEffetBudget({ budgetDecision, nouvelEngagement, ponctuel, budgetAvant, budget }) {
  if (!budgetDecision && !ponctuel) return '';
  const ligne = trouverLigne(budgetDecision?.poste);
  const nomLigne = ligne ? `${ligne.emoji} ${ligne.libelle}` : '💶 Budget';
  const morceaux = [];

  if (nouvelEngagement) {
    const montant = nouvelEngagement.montantMensuel;
    const verbe = montant > 0 ? 'coûte' : 'fait économiser';
    const duree = nouvelEngagement.toursRestants === null
      ? 'pour toujours'
      : `pendant ${budgetDecision.dureeMois} mois`;
    morceaux.push(`${nomLigne} : ${verbe} ${formatMontant(Math.abs(montant))} par mois, dès maintenant et ${duree}.`);
  }
  if (ponctuel) {
    morceaux.push(`${nomLigne} : ${ponctuel > 0 ? 'dépense immédiate de' : 'rentrée immédiate de'} ${formatMontant(Math.abs(ponctuel))}.`);
  }
  if (budgetDecision?.calcul) morceaux.push(`(${budgetDecision.calcul})`);
  if (Math.abs(budget.deficit - budgetAvant.deficit) >= 0.05) {
    morceaux.push(`Déficit mensuel : ${formatMd1.format(budgetAvant.deficit)} → ${formatMd1.format(budget.deficit)} Md€.`);
  }
  return morceaux.join(' ');
}

// { texte, reaction, libre, variations, termines, detteDuTour, ponctuel, budgetAvant, budget, budgetDecision, nouvelEngagement }
export function afficherDecision(resultat) {
  const { texte, reaction, libre, variations, termines, detteDuTour, ponctuel } = resultat;
  el['decision-texte'].textContent = libre ? `✍️ « ${texte} » (votre idée)` : `« ${texte} »`;

  el['decision-reaction'].textContent = reaction ?? '';
  el['decision-reaction'].hidden = !reaction;

  // Liste des effets, construite élément par élément (pas d'innerHTML).
  const lignes = [];
  for (const { nom, libelle } of blocsJauges) {
    const variation = variations[nom];
    if (!variation) continue;
    const ligne = document.createElement('li');
    if (nom === 'dette') {
      const details = [`${formatMd1.format(detteDuTour)} de déficit`];
      if (ponctuel) details.push(`${formatSigne.format(ponctuel)} immédiat`);
      ligne.textContent = `${libelle} : ${formatVariation.format(variation)} Md€ (${details.join(', ')})`;
    } else {
      ligne.textContent = `${libelle} : ${formatVariation.format(variation)}`;
    }
    ligne.className = estUnCout(nom, variation) ? 'effet-mauvais' : 'effet-bon';
    lignes.push(ligne);
  }
  el['decision-effets'].replaceChildren(...lignes);

  const effetBudget = decrireEffetBudget(resultat);
  el['decision-budget'].textContent = effetBudget;
  el['decision-budget'].hidden = !effetBudget;

  el['decision-fins'].textContent = termines.length
    ? `✅ Mesure${termines.length > 1 ? 's' : ''} terminée${termines.length > 1 ? 's' : ''} : ${termines.map((e) => `« ${e.libelle} »`).join(', ')}.`
    : '';
  el['decision-fins'].hidden = termines.length === 0;

  el['derniere-decision'].hidden = false;
}

export function masquerDecision() {
  el['derniere-decision'].hidden = true;
}

// ---------------------------------------------------------------------
// Finances publiques
// ---------------------------------------------------------------------

// Les listes de lignes sont construites UNE fois ; ensuite on ne met à jour que
// les montants et les barres (une ligne supprimée à -100 % se vide sous vos yeux).
function construireListe(conteneur, lignes) {
  const references = new Map();
  conteneur.replaceChildren(...lignes.map((ligne) => {
    const li = document.createElement('li');
    li.className = `poste${ligne.id === LIGNE_INTERETS.id ? ' poste-dette' : ''}`;
    const nom = document.createElement('span');
    nom.className = 'poste-nom';
    nom.textContent = `${ligne.emoji} ${ligne.libelle}`;
    const montant = document.createElement('span');
    montant.className = 'poste-montant';
    const barre = document.createElement('span');
    barre.className = 'poste-barre';
    const remplissage = document.createElement('span');
    barre.append(remplissage);
    li.append(nom, montant, barre);
    references.set(ligne.id, { li, montant, remplissage });
    return li;
  }));
  return references;
}

const lignesDepensesAffichees = construireListe(el['budget-postes'], [LIGNES_DEPENSES[0], LIGNE_INTERETS, ...LIGNES_DEPENSES.slice(1)]);
const lignesRecettesAffichees = construireListe(el['budget-lignes-recettes'], LIGNES_RECETTES);
const maxDepense = Math.max(...LIGNES_DEPENSES.map((ligne) => ligne.montantAn));
const maxRecette = Math.max(...LIGNES_RECETTES.map((ligne) => ligne.montantAn));

function mettreAJourLigne(references, { id, base, effectif }, maximum) {
  const { li, montant, remplissage } = references.get(id);
  const ecart = base ? (effectif - base) / base : 0;
  // On affiche l'écart en % si le joueur a modifié la ligne (« −50 % »).
  montant.textContent = Math.abs(ecart) >= 0.005
    ? `${formatMd1.format(effectif)} Md€ (${formatEcart.format(ecart)})`
    : `${formatMd1.format(effectif)} Md€`;
  remplissage.style.width = `${Math.min(100, (effectif / maximum) * 100)}%`;
  li.classList.toggle('poste-modifie', Math.abs(ecart) >= 0.005);
}

// budget : résultat de budgetDuMois() ; engagements : mesures en cours.
export function afficherBudget(budget, engagements, jauges) {
  el['budget-recettes'].textContent = `${formatMd1.format(budget.recettes)} Md€`;
  el['budget-depenses'].textContent = `${formatMd1.format(budget.depenses)} Md€`;
  el['budget-deficit'].textContent = `${formatMd1.format(budget.deficit)} Md€`;
  el['budget-ratio'].textContent = formatPourcent.format(ratioDettePib(jauges.dette));

  for (const ligne of budget.lignesDepenses) mettreAJourLigne(lignesDepensesAffichees, ligne, maxDepense);
  const interetsAn = budget.chargeDette * 12;
  mettreAJourLigne(lignesDepensesAffichees, { id: LIGNE_INTERETS.id, base: 0, effectif: interetsAn }, maxDepense);
  for (const ligne of budget.lignesRecettes) mettreAJourLigne(lignesRecettesAffichees, ligne, maxRecette);

  // Mesures en cours : les plus grosses d'abord.
  const tries = [...engagements].sort((a, b) => Math.abs(b.montantMensuel) - Math.abs(a.montantMensuel));
  el['budget-mesures'].replaceChildren(...tries.map((engagement) => {
    const ligne = document.createElement('li');
    ligne.className = engagement.montantMensuel > 0 ? 'mesure effet-mauvais' : 'mesure effet-bon';
    const nom = document.createElement('span');
    nom.className = 'mesure-nom';
    nom.textContent = `${trouverLigne(engagement.poste)?.emoji ?? '📦'} ${engagement.libelle}`;
    const detail = document.createElement('span');
    detail.className = 'mesure-detail';
    detail.textContent = `${formatMontant(engagement.montantMensuel, true)}/mois sur le déficit · ${decrireReste(engagement.toursRestants)}`;
    ligne.append(nom, detail);
    return ligne;
  }));
  el['budget-mesures-vide'].hidden = engagements.length > 0;
  el['budget-mesures-total'].textContent = engagements.length
    ? `(${formatMontant(budget.mesures, true)}/mois)`
    : '';
}

// ---------------------------------------------------------------------
// Événement du tour
// ---------------------------------------------------------------------

export function afficherChargement(actif) {
  el.chargement.hidden = !actif;
  if (actif) {
    // Pendant le chargement, on cache l'ancien événement : impossible de recliquer dessus.
    el.evenement.hidden = true;
    el.erreur.hidden = true;
  }
}

// evenement : { titre, description, personnage: { nom, role, emoji } | null, choix }
// source : 'ia' | 'secours' | 'calendrier'
// suiteDe : numéro du tour dont cet événement est la conséquence, ou null
export function afficherEvenement(evenement, source, suiteDe) {
  el['evenement-suite'].textContent = suiteDe ? `🔗 Conséquence de votre décision du tour ${suiteDe}` : '';
  el['evenement-suite'].hidden = !suiteDe;

  afficherPersonnage(evenement.personnage);

  el['evenement-titre'].textContent = evenement.titre;
  el['evenement-description'].textContent = evenement.description;

  // Seulement le texte du choix : ses effets (et son coût) restent une surprise.
  boutonsChoix.forEach((bouton, i) => {
    bouton.textContent = evenement.choix[i].texte;
  });

  // Nouveau tour : le champ de choix libre repart de zéro.
  el['choix-libre'].value = '';
  afficherMessageChoixLibre('');
  bloquerChoix(false);

  // Petite mention utile pour tester (et pour la vidéo) : d'où vient l'événement ?
  const sources = {
    ia: 'Événement généré par l\'IA',
    calendrier: '📅 Rendez-vous du calendrier (événement écrit à l\'avance)',
    secours: 'Événement de secours (l\'IA n\'a pas répondu)',
  };
  el['evenement-source'].textContent = sources[source] ?? '';
  el.evenement.hidden = false;
}

// Avatar rond + nom + rôle. On crée les éléments un par un (pas d'innerHTML)
// pour que le CSS puisse styler chaque morceau séparément.
function afficherPersonnage(personnage) {
  const zone = el['evenement-personnage'];
  zone.hidden = !personnage;
  if (!personnage) {
    zone.replaceChildren();
    return;
  }

  const avatar = document.createElement('span');
  avatar.className = 'personnage-emoji';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = personnage.emoji;

  const nom = document.createElement('span');
  nom.className = 'personnage-nom';
  nom.textContent = personnage.nom;

  const role = document.createElement('span');
  role.className = 'personnage-role';
  role.textContent = personnage.role;

  const identite = document.createElement('span');
  identite.append(nom, role);
  zone.replaceChildren(avatar, identite);
}

export function afficherErreur(message) {
  el['erreur-message'].textContent = message;
  el.erreur.hidden = false;
}

// ---------------------------------------------------------------------
// Choix libre
// ---------------------------------------------------------------------

// Pendant que l'IA évalue une idée, on bloque les 3 boutons ET le formulaire :
// le joueur ne peut pas jouer deux décisions en même temps.
export function bloquerChoix(bloque) {
  boutonsChoix.forEach((bouton) => { bouton.disabled = bloque; });
  el['choix-libre'].disabled = bloque;
  el['bouton-choix-libre'].disabled = bloque;
  el['bouton-choix-libre'].textContent = bloque ? 'Le Conseil des ministres délibère…' : 'Proposer';
}

export function afficherMessageChoixLibre(message) {
  el['choix-libre-message'].textContent = message;
  el['choix-libre-message'].hidden = !message;
}

// ---------------------------------------------------------------------
// Fin de partie
// ---------------------------------------------------------------------

export function afficherFin(tour, message, libelleDateFin) {
  // Le tour où l'on tombe n'est pas « tenu » : on compte les tours complets.
  const toursTenus = tour - 1;
  const pluriel = toursTenus > 1 ? 's' : '';
  const date = libelleDateFin ? ` (${libelleDateFin.toLowerCase()})` : '';
  el['fin-tours'].textContent = `Chute au tour ${tour}${date} : vous avez tenu ${toursTenus} tour${pluriel} complet${pluriel}.`;
  el['fin-message'].textContent = message;
  el.evenement.hidden = true;
  el['ecran-fin'].hidden = false;
  // La fenêtre de fin passe devant le jeu : on y place le focus clavier
  // (Entrée relance directement une partie).
  el['bouton-rejouer'].focus();
}

export function afficherChargementBilan(actif) {
  el['fin-bilan-chargement'].hidden = !actif;
}

// bilan : { titre, resume }
export function afficherBilan(bilan) {
  el['fin-bilan-titre'].textContent = `« ${bilan.titre} »`;
  el['fin-bilan-resume'].textContent = bilan.resume;
  // Le verdict est prêt : on peut publier le mandat sur le mur.
  el['bouton-publier'].disabled = false;
}

export function masquerFin() {
  el['ecran-fin'].hidden = true;
  // On vide le bilan de la partie précédente.
  el['fin-bilan-titre'].textContent = '';
  el['fin-bilan-resume'].textContent = '';
  el['bouton-publier'].disabled = true;
  afficherChargementBilan(false);
}

// ---------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------

// game.js fournit les fonctions à appeler ; ce fichier les relie aux boutons.
export function brancherBoutons({ onChoix, onChoixLibre, onReessayer, onRejouer, onPublier, onNouvellePartie }) {
  boutonsChoix.forEach((bouton) => {
    bouton.addEventListener('click', () => onChoix(Number(bouton.dataset.index)));
  });
  el['form-choix-libre'].addEventListener('submit', (evenement) => {
    evenement.preventDefault(); // sinon le formulaire rechargerait la page
    onChoixLibre(el['choix-libre'].value);
  });
  el['bouton-reessayer'].addEventListener('click', onReessayer);
  el['bouton-rejouer'].addEventListener('click', onRejouer);
  el['bouton-publier'].addEventListener('click', onPublier);
  el['bouton-nouvelle-partie'].addEventListener('click', onNouvellePartie);
}
