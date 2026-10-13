// =====================================================================
// discussion.js — La page « Discussion » : une conversation avec l'IA,
// libre ou avec un thème de départ.
//
// La réponse de l'IA arrive MORCEAU PAR MORCEAU : on l'affiche au fur et à
// mesure, comme si elle tapait.
//
// Dans les thèmes spécialisés (💶), les DÉCISIONS du joueur font bouger le
// budget, au choix du joueur :
//  - « Ma partie » : la partie en cours du jeu (sauvegardée dans le navigateur) ;
//  - « Bac à sable » : un budget d'essai qui part des vrais chiffres.
// Une IA « arbitre » repère la décision et la chiffre ; elle s'applique tout
// de suite (sans faire passer de tour), avec un bouton Annuler.
// =====================================================================

import { appliquerMesure, budgetDuMois, causeDeFin, ratioDettePib } from './regles.js';
import { trouverLigne } from './donnees-budget.js';
import { appeler } from './serveur.js';
import {
  CLE_PARTIE, CLE_BAC_A_SABLE, lire, ecrire, effacer, nouveauBacASable, lireMode, ecrireMode,
} from './partie.js';

const element = (id) => document.getElementById(id);
const fil = element('fil');
const saisie = element('saisie');
const boutonEnvoyer = element('bouton-envoyer');

const formatMd1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const formatSigne = new Intl.NumberFormat('fr-FR', { signDisplay: 'exceptZero', maximumFractionDigits: 2 });
const formatPourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const LIBELLES = { popularite: 'Popularité', economie: 'Économie', education: 'Éducation', ordre: 'Ordre public' };

let themes = [];
let theme = null;
let messages = []; // [{ role: 'user' | 'assistant', content }]
let enCours = null; // AbortController de la réponse en cours (pour pouvoir l'arrêter)
let mode = lireMode(); // 'partie' ou 'bac'

function creer(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function afficherErreur(texte) {
  element('discussion-erreur').textContent = texte;
  element('discussion-erreur').hidden = !texte;
}

// Montant positif lisible : « 50 M€ » sous 0,1 Md€, « 2,2 Md€ » au-dessus.
const formatMd = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
function formatMontant(milliards) {
  return milliards < 0.1 ? `${Math.round(milliards * 1000)} M€` : `${formatMd.format(milliards)} Md€`;
}

// ---------------------------------------------------------------------
// Le budget utilisé (partie en cours ou bac à sable)
// ---------------------------------------------------------------------

const cleDuMode = (unMode) => (unMode === 'partie' ? CLE_PARTIE : CLE_BAC_A_SABLE);

// La situation du budget choisi : { tour, jauges, engagements, journal, ... } ou null.
function lireSituation(unMode = mode) {
  if (unMode === 'partie') return lire(CLE_PARTIE);
  return lire(CLE_BAC_A_SABLE) ?? nouveauBacASable();
}

function afficherBudget() {
  document.querySelectorAll('.budget-discussion .onglet').forEach((onglet) => {
    onglet.setAttribute('aria-pressed', String(onglet.dataset.mode === mode));
  });
  const situation = lireSituation();
  const explication = element('mode-explication');
  element('bouton-reinitialiser').hidden = mode !== 'bac';
  element('lien-partie').hidden = !(mode === 'partie' && !situation);
  element('mini-finances').hidden = !situation;
  element('mini-jauges').hidden = !situation;

  if (!situation) {
    explication.textContent = 'Aucune partie en cours. Lance une partie depuis « Jouer », ou utilise le bac à sable.';
    return;
  }
  explication.textContent = mode === 'partie'
    ? `Tes décisions modifient ta partie en cours (tour ${situation.tour}). Le temps n'avance pas pendant une discussion.`
    : 'Tes décisions modifient un budget d\'essai, qui part des vrais chiffres. Ta partie n\'est pas touchée.';
  if (theme && !theme.bougeLeBudget) explication.textContent += ' La discussion libre, elle, ne touche pas au budget.';

  const budget = budgetDuMois(situation.jauges, situation.engagements);
  element('mini-deficit').textContent = `${formatMd1.format(budget.deficit)} Md€`;
  element('mini-dette').textContent = `${formatEntier.format(situation.jauges.dette)} Md€ (${formatPourcent.format(ratioDettePib(situation.jauges.dette))})`;
  element('mini-jauges').replaceChildren(...Object.entries(LIBELLES).map(([nom, libelle]) => {
    const valeur = situation.jauges[nom];
    const ligne = creer('li', valeur <= 20 ? 'mini-jauge danger' : 'mini-jauge');
    ligne.append(creer('span', null, libelle), creer('strong', null, String(valeur)));
    return ligne;
  }));
}

document.querySelectorAll('.budget-discussion .onglet').forEach((onglet) => {
  onglet.addEventListener('click', () => {
    mode = onglet.dataset.mode;
    ecrireMode(mode);
    afficherBudget();
  });
});

element('bouton-reinitialiser').addEventListener('click', () => {
  effacer(CLE_BAC_A_SABLE);
  afficherBudget();
});

// Le jeu (dans un autre onglet) a avancé : on rafraîchit le panneau.
window.addEventListener('storage', (evenement) => {
  if (evenement.key === CLE_PARTIE || evenement.key === CLE_BAC_A_SABLE) afficherBudget();
});

// ---------------------------------------------------------------------
// Appliquer une décision prise en conversation
// ---------------------------------------------------------------------

function appliquerDecision(decision, apres) {
  const modeApplique = mode;
  const cle = cleDuMode(modeApplique);
  const avant = lireSituation(modeApplique);
  if (!avant) return;

  const tour = avant.tour ?? 1;
  const resultat = appliquerMesure(avant, decision, tour);
  const nouvelle = {
    ...avant,
    jauges: resultat.jauges,
    engagements: resultat.engagements,
    // La décision rejoint le journal : l'IA du jeu s'en souviendra.
    journal: [...(avant.journal ?? []), {
      tour, titre: `Discussion : ${theme.titre}`, choix: decision.texte, personnage: theme.personnage, libre: true,
    }].slice(-60),
  };
  ecrire(cle, nouvelle);
  const empreinte = JSON.stringify(lire(cle)); // pour savoir si on peut encore annuler
  afficherBudget();

  apres.after(construireCarteDecision(decision, resultat, modeApplique, () => {
    // Annuler : seulement si rien n'a changé depuis (sinon on effacerait d'autres décisions).
    if (JSON.stringify(lire(cle)) !== empreinte) return false;
    ecrire(cle, avant);
    afficherBudget();
    return true;
  }));
}

function construireCarteDecision(decision, resultat, modeApplique, annuler) {
  const carte = creer('li', 'carte-decision');
  const entete = creer('div', 'carte-decision-entete');
  entete.append(creer('strong', null, `✅ Décision appliquée · ${modeApplique === 'partie' ? '🎮 Ma partie' : '🧪 Bac à sable'}`));
  const boutonAnnuler = creer('button', 'bouton-annuler', 'Annuler');
  boutonAnnuler.type = 'button';
  entete.append(boutonAnnuler);
  carte.append(entete, creer('p', 'carte-decision-texte', `« ${decision.texte} »`));

  // L'effet budgétaire, appliqué tout de suite.
  const details = [];
  const budget = decision.budget;
  if (budget) {
    const ligne = trouverLigne(budget.poste);
    const nomLigne = ligne ? `${ligne.emoji} ${ligne.libelle}` : '💶 Budget';
    if (budget.type === 'ponctuel') {
      details.push(`${nomLigne} : ${resultat.ponctuel > 0 ? 'dépense immédiate de' : 'rentrée immédiate de'} ${formatMontant(Math.abs(resultat.ponctuel))}`);
    } else {
      const montant = resultat.nouvelEngagement.montantMensuel;
      const duree = budget.type === 'permanent' ? 'pour toujours' : `pendant ${budget.dureeMois} mois`;
      details.push(`${nomLigne} : ${montant > 0 ? 'coûte' : 'fait économiser'} ${formatMontant(Math.abs(montant))} par mois, ${duree}`);
    }
    if (budget.calcul) details.push(`(${budget.calcul})`);
  }
  // Si la jauge Économie a bougé, les impôts encaissés aussi : on le précise,
  // sinon l'écart entre le coût de la mesure et le déficit paraîtrait mystérieux.
  const effetEconomie = resultat.variations.economie ? ' (y compris l\'effet de l\'économie sur les impôts)' : '';
  details.push(`Déficit : ${formatMd1.format(resultat.budgetAvant.deficit)} → ${formatMd1.format(resultat.budget.deficit)} Md€/mois${effetEconomie}`);
  carte.append(creer('p', 'carte-decision-budget', details.join(' · ')));

  // Les jauges qui ont bougé
  const puces = creer('ul', 'carte-decision-effets');
  for (const [nom, libelle] of Object.entries(LIBELLES)) {
    const variation = resultat.variations[nom];
    if (variation) puces.append(creer('li', variation > 0 ? 'effet-bon' : 'effet-mauvais', `${libelle} ${formatSigne.format(variation)}`));
  }
  if (puces.children.length) carte.append(puces);

  if (causeDeFin(resultat.jauges)) {
    carte.append(creer('p', 'carte-decision-alerte', modeApplique === 'partie'
      ? '⚠️ Cette décision fait tomber l\'État : ta partie se terminera en revenant au jeu.'
      : '⚠️ Dans une vraie partie, l\'État s\'effondrerait ici.'));
  }

  boutonAnnuler.addEventListener('click', () => {
    if (annuler()) {
      carte.classList.add('annulee');
      boutonAnnuler.remove();
      entete.firstChild.textContent = '↩️ Décision annulée';
    } else {
      boutonAnnuler.disabled = true;
      boutonAnnuler.textContent = 'Trop tard : le budget a changé depuis';
    }
  });
  return carte;
}

// Demande à l'arbitre si le dernier message est une décision. Tourne EN MÊME
// TEMPS que la réponse en direct : la décision s'applique dès qu'elle est prête.
async function analyserDecision(bulleJoueur, themeDeLaDemande) {
  const situation = lireSituation();
  if (!themeDeLaDemande.bougeLeBudget || !situation) return;
  try {
    const reponse = await appeler('/api/discussion/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: themeDeLaDemande.id,
        messages: messages.slice(-6),
        situation: { tour: situation.tour, jauges: situation.jauges, engagements: situation.engagements },
      }),
    });
    const { decision } = await reponse.json();
    // Le joueur a changé de thème entre-temps : on n'applique rien.
    if (decision && theme === themeDeLaDemande && bulleJoueur.isConnected) appliquerDecision(decision, bulleJoueur);
  } catch {
    // Arbitre injoignable : la conversation continue, le budget ne bouge pas.
  }
}

// ---------------------------------------------------------------------
// Fil de la conversation
// ---------------------------------------------------------------------

// Ajoute une bulle au fil. Renvoie la bulle et l'élément du texte (pour le compléter en direct).
function ajouterBulle(role, texte) {
  const bulle = creer('li', `bulle bulle-${role === 'user' ? 'joueur' : 'ia'}`);
  if (role !== 'user') bulle.append(creer('span', 'bulle-emoji', theme.emoji));
  const contenu = creer('p', 'bulle-texte', texte);
  bulle.append(contenu);
  fil.append(bulle);
  fil.scrollTop = fil.scrollHeight;
  return { bulle, contenu };
}

function afficherThemes() {
  element('liste-themes').replaceChildren(...themes.map((t) => {
    const bouton = creer('button', 'theme');
    bouton.type = 'button';
    bouton.setAttribute('aria-pressed', String(t.id === theme?.id));
    bouton.append(
      creer('span', 'theme-emoji', t.emoji),
      creer('span', 'theme-titre', `${t.titre}${t.bougeLeBudget ? ' 💶' : ''}`),
      creer('span', 'theme-description', t.description),
    );
    bouton.addEventListener('click', () => choisirTheme(t.id));
    return bouton;
  }));
}

function choisirTheme(id) {
  enCours?.abort(); // on coupe une éventuelle réponse en cours
  theme = themes.find((t) => t.id === id) ?? themes[0];
  messages = [];
  fil.replaceChildren();
  afficherErreur('');

  element('conversation-emoji').textContent = theme.emoji;
  element('conversation-titre').textContent = theme.titre;
  element('conversation-description').textContent = theme.description;

  // Message d'accueil du thème (les personnages, eux, se présentent quand on leur parle).
  if (theme.accueil) {
    messages.push({ role: 'assistant', content: theme.accueil });
    ajouterBulle('assistant', theme.accueil);
  } else {
    fil.append(creer('li', 'fil-astuce', `Dis bonjour à ${theme.titre} pour commencer la conversation.`));
  }
  if (theme.bougeLeBudget) {
    fil.append(creer('li', 'fil-astuce', '💶 Ici, quand tu tranches (« je décide de… », « adopté »), ta décision s\'applique au budget.'));
  }

  // L'adresse garde le thème : on peut partager un lien direct (discussion.html?theme=calculette).
  // On ne touche qu'au paramètre « theme » (les autres, comme « vue » dans le fichier unique, restent).
  const adresse = new URL(location.href);
  adresse.searchParams.set('theme', theme.id);
  history.replaceState(null, '', adresse);
  afficherThemes();
  afficherBudget();
  saisie.focus();
}

async function envoyer() {
  const texte = saisie.value.trim();
  if (!texte || enCours) return;

  saisie.value = '';
  afficherErreur('');
  fil.querySelectorAll('.fil-astuce').forEach((astuce) => astuce.remove());
  messages.push({ role: 'user', content: texte });
  const { bulle: bulleJoueur } = ajouterBulle('user', texte);
  const themeDeLaDemande = theme;

  // En parallèle : l'arbitre cherche une décision dans ce message.
  analyserDecision(bulleJoueur, themeDeLaDemande);

  const { bulle, contenu: zoneReponse } = ajouterBulle('assistant', '');
  zoneReponse.classList.add('en-train-d-ecrire');
  enCours = new AbortController();
  boutonEnvoyer.disabled = true;
  const situation = themeDeLaDemande.bougeLeBudget ? lireSituation() : null;

  try {
    const reponse = await appeler('/api/discussion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: theme.id,
        messages,
        // L'IA connaît l'état du pays (jauges, déficit) pour en parler avec justesse.
        situation: situation && { tour: situation.tour, jauges: situation.jauges, engagements: situation.engagements },
      }),
      signal: enCours.signal,
    });
    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => ({}));
      throw new Error(donnees.erreur ?? `Erreur ${reponse.status}`);
    }

    // Lecture du texte au fur et à mesure qu'il arrive.
    const lecteur = reponse.body.pipeThrough(new TextDecoderStream()).getReader();
    let complet = '';
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      zoneReponse.classList.remove('en-train-d-ecrire');
      complet += value;
      zoneReponse.textContent = complet;
      fil.scrollTop = fil.scrollHeight;
    }
    messages.push({ role: 'assistant', content: complet });
  } catch (erreur) {
    if (theme !== themeDeLaDemande || erreur.name === 'AbortError') return; // thème changé entre-temps
    bulle.remove();
    messages.pop(); // on retire le message sans réponse : on pourra le renvoyer
    saisie.value = texte;
    afficherErreur(erreur.message === 'Failed to fetch' ? 'Impossible de joindre le serveur du jeu. Est-il lancé ?' : erreur.message);
  } finally {
    enCours = null;
    boutonEnvoyer.disabled = false;
    saisie.focus();
  }
}

element('form-discussion').addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  envoyer();
});

// Entrée = envoyer ; Maj+Entrée = aller à la ligne.
saisie.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Enter' && !evenement.shiftKey) {
    evenement.preventDefault();
    envoyer();
  }
});

element('bouton-nouvelle').addEventListener('click', () => choisirTheme(theme.id));

// ---------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------

async function demarrer() {
  afficherBudget();
  try {
    ({ themes } = await (await appeler('/api/discussion/themes')).json());
  } catch {
    afficherErreur('Impossible de joindre le serveur du jeu. Est-il lancé ?');
    return;
  }
  choisirTheme(new URLSearchParams(location.search).get('theme') ?? 'libre');
}

demarrer();
