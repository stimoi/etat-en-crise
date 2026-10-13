// =====================================================================
// resultats.js — La page « Le mur des mandats ».
//
// Elle affiche les mandats publiés (stockés sur Discord par le serveur),
// et permet, une fois connecté avec Discord, de publier le sien, de liker,
// disliker et commenter. Comme dans le jeu : textContent partout, jamais
// innerHTML (les textes viennent des joueurs et de l'IA).
// =====================================================================

import { appeler, adresseConnexion, seConnecter, seDeconnecter, oublierSession } from './serveur.js';

// Le jeu dépose ici le résultat de la dernière partie avant d'ouvrir cette page.
export const CLE_RESULTAT = 'etat-en-crise:resultat-a-publier';

const element = (id) => document.getElementById(id);
const modele = element('modele-publication');
const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const formatDette = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const LIBELLES_CAUSES = {
  dette: 'Faillite (dette)',
  popularite: 'Popularité à zéro',
  economie: 'Économie effondrée',
  ordre: 'Chaos (ordre public)',
};

const MESSAGES_ERREUR = {
  'non-configure': 'La connexion Discord n\'est pas encore configurée sur ce serveur (voir le README).',
  connexion: 'La connexion avec Discord a échoué. Réessaie.',
  annule: 'Connexion annulée.',
};

let moi = { joueur: null, connexionPossible: false, murDisponible: false };
let tri = 'recent';

// ---------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------

async function api(url, options = {}) {
  const reponse = await appeler(url, {
    ...options,
    headers: options.corps ? { 'Content-Type': 'application/json' } : undefined,
    body: options.corps ? JSON.stringify(options.corps) : undefined,
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const erreur = new Error(donnees.erreur ?? `Erreur ${reponse.status}`);
    erreur.statut = reponse.status;
    erreur.donnees = donnees;
    throw erreur;
  }
  return donnees;
}

// Le stockage du navigateur peut être bloqué (navigation privée...) : on ne plante jamais.
function lireResultatEnAttente() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_RESULTAT));
  } catch {
    return null;
  }
}

function oublierResultat() {
  try {
    sessionStorage.removeItem(CLE_RESULTAT);
  } catch {
    // rien à faire
  }
}

function creer(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function lienConnexion(retour, texte = 'Se connecter avec Discord') {
  const lien = creer('a', 'bouton-discord', texte);
  lien.href = adresseConnexion(retour);
  lien.addEventListener('click', (evenement) => {
    evenement.preventDefault();
    seConnecter(retour);
  });
  return lien;
}

function afficherMessage(texte) {
  element('mur-message').textContent = texte;
  element('mur-message').hidden = !texte;
}

// ---------------------------------------------------------------------
// Compte (en haut à droite)
// ---------------------------------------------------------------------

function afficherCompte() {
  const zone = element('compte');
  if (moi.joueur) {
    const avatar = creer('img', 'avatar avatar-petit');
    avatar.src = moi.joueur.avatar;
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    const deconnexion = creer('button', 'bouton-secondaire', 'Déconnexion');
    deconnexion.addEventListener('click', async () => {
      await seDeconnecter();
      location.reload();
    });
    zone.replaceChildren(avatar, creer('span', 'compte-nom', moi.joueur.nom), deconnexion);
  } else if (moi.connexionPossible) {
    zone.replaceChildren(lienConnexion('/resultats.html'));
    // Transparence : on dit AVANT la connexion qu'elle ajoute au serveur Discord du jeu.
    if (moi.ajoutServeur) zone.append(creer('small', 'compte-note', 'En te connectant, tu rejoins aussi le serveur Discord du jeu.'));
  } else {
    zone.replaceChildren(creer('span', 'compte-nom', 'Connexion Discord non configurée'));
  }
}

// ---------------------------------------------------------------------
// Le résultat à publier
// ---------------------------------------------------------------------

function puces(liste, textes) {
  liste.replaceChildren(...textes.filter(Boolean).map((t) => creer('li', null, t)));
}

function statistiques(resultat) {
  return [
    `🗓️ ${resultat.tours} tour${resultat.tours > 1 ? 's' : ''} tenu${resultat.tours > 1 ? 's' : ''}`,
    `💥 ${resultat.causeLibelle ?? LIBELLES_CAUSES[resultat.cause] ?? resultat.cause}`,
    `💶 ${formatDette.format(resultat.dette)} Md€ de dette`,
    resultat.periode ? `📅 ${resultat.periode}` : null,
  ];
}

function afficherAPublier() {
  const resultat = lireResultatEnAttente();
  element('a-publier').hidden = !resultat || !moi.murDisponible;
  if (!resultat || !moi.murDisponible) return;

  const apercu = element('a-publier-apercu');
  const stats = creer('ul', 'publication-stats');
  puces(stats, statistiques(resultat));
  apercu.replaceChildren(
    creer('h3', 'publication-titre', `« ${resultat.titre} »`),
    creer('p', 'publication-resume', resultat.resume),
    stats,
  );

  // Pas connecté : le bouton « Publier » devient « Se connecter pour publier ».
  const bouton = element('bouton-publier');
  bouton.textContent = moi.joueur ? '📣 Publier sur le mur' : '🔑 Se connecter avec Discord pour publier';
}

element('form-publier').addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  if (!moi.joueur) {
    // Le résultat reste dans le navigateur pendant l'aller-retour vers Discord.
    seConnecter('/resultats.html#publier');
    return;
  }
  const resultat = lireResultatEnAttente();
  const bouton = element('bouton-publier');
  bouton.disabled = true;
  element('publier-erreur').hidden = true;
  try {
    await api('/api/resultats', { method: 'POST', corps: { ...resultat, message: element('publier-message').value } });
    oublierResultat();
    element('a-publier').hidden = true;
    tri = 'recent';
    await chargerMur();
    window.scrollTo({ top: element('mur').offsetTop - 20, behavior: 'smooth' });
  } catch (erreur) {
    element('publier-erreur').textContent = erreur.message;
    element('publier-erreur').hidden = false;
  } finally {
    bouton.disabled = false;
  }
});

element('bouton-oublier').addEventListener('click', () => {
  oublierResultat();
  element('a-publier').hidden = true;
});

// ---------------------------------------------------------------------
// Le mur
// ---------------------------------------------------------------------

async function chargerMur() {
  document.querySelectorAll('.onglet').forEach((onglet) => {
    onglet.setAttribute('aria-pressed', String(onglet.dataset.tri === tri));
  });
  try {
    const { resultats } = await api(`/api/resultats?tri=${tri}`);
    const mur = element('mur');
    if (resultats.length === 0) {
      mur.replaceChildren(creer('p', 'carte mur-vide', 'Aucun mandat publié pour l\'instant. Termine une partie et sois le premier !'));
      return;
    }
    mur.replaceChildren(...resultats.map(construirePublication));
  } catch (erreur) {
    element('mur').replaceChildren();
    afficherMessage(erreur.message);
  }
}

function construirePublication(publication) {
  const carte = modele.content.firstElementChild.cloneNode(true);
  const trouver = (selecteur) => carte.querySelector(selecteur);

  const avatar = trouver('.avatar');
  if (publication.auteur.avatar) avatar.src = publication.auteur.avatar;
  else avatar.hidden = true;
  trouver('.publication-auteur').textContent = publication.auteur.nom;
  trouver('.publication-date').textContent = formatDate.format(new Date(publication.date));
  trouver('.publication-titre').textContent = `« ${publication.titre} »`;
  trouver('.publication-resume').textContent = publication.resume;
  puces(trouver('.publication-stats'), statistiques(publication));
  puces(trouver('.publication-reformes'), publication.reformes.map((r) => `🔧 ${r}`));
  if (publication.message) {
    trouver('.publication-mot').textContent = `« ${publication.message} »`;
    trouver('.publication-mot').hidden = false;
  }

  brancherVotes(carte, publication);
  brancherCommentaires(carte, publication);
  return carte;
}

// Like / dislike : l'affichage change TOUT DE SUITE, puis on enregistre.
// Si Discord refuse, on remet l'affichage comme avant.
function brancherVotes(carte, publication) {
  const boutons = [...carte.querySelectorAll('.bouton-vote')];
  const rafraichir = () => {
    for (const bouton of boutons) {
      const valeur = Number(bouton.dataset.vote);
      bouton.querySelector('.compteur').textContent = valeur === 1 ? publication.likes : publication.dislikes;
      bouton.setAttribute('aria-pressed', String(publication.monVote === valeur));
    }
  };
  rafraichir();

  for (const bouton of boutons) {
    bouton.addEventListener('click', async () => {
      if (!moi.joueur) {
        afficherMessage('Connecte-toi avec Discord pour voter.');
        return;
      }
      const valeur = Number(bouton.dataset.vote);
      const avant = { likes: publication.likes, dislikes: publication.dislikes, monVote: publication.monVote };
      const nouveau = publication.monVote === valeur ? 0 : valeur; // re-cliquer annule le vote

      // Mise à jour immédiate de l'affichage
      if (publication.monVote === 1) publication.likes -= 1;
      if (publication.monVote === -1) publication.dislikes -= 1;
      if (nouveau === 1) publication.likes += 1;
      if (nouveau === -1) publication.dislikes += 1;
      publication.monVote = nouveau;
      rafraichir();

      try {
        Object.assign(publication, await api(`/api/resultats/${publication.id}/vote`, { method: 'POST', corps: { valeur: nouveau } }));
      } catch (erreur) {
        Object.assign(publication, avant);
        afficherMessage(erreur.message);
      }
      rafraichir();
    });
  }
}

function construireCommentaire(commentaire) {
  const ligne = creer('li', 'commentaire');
  const avatar = creer('img', 'avatar avatar-petit');
  avatar.alt = '';
  avatar.referrerPolicy = 'no-referrer';
  if (commentaire.auteur.avatar) avatar.src = commentaire.auteur.avatar;
  const contenu = creer('div', 'commentaire-contenu');
  contenu.append(
    creer('span', 'commentaire-auteur', commentaire.auteur.nom),
    creer('span', 'commentaire-date', formatDate.format(new Date(commentaire.date))),
    creer('p', 'commentaire-texte', commentaire.texte),
  );
  ligne.append(avatar, contenu);
  return ligne;
}

function brancherCommentaires(carte, publication) {
  const bouton = carte.querySelector('.bouton-commentaires');
  const zone = carte.querySelector('.commentaires');
  const liste = carte.querySelector('.commentaires-liste');
  const chargement = carte.querySelector('.commentaires-chargement');
  const formulaire = carte.querySelector('.form-commentaire');
  const champ = formulaire.querySelector('input');
  let charges = false;

  const compter = () => {
    bouton.querySelector('.compteur').textContent = publication.nbCommentaires;
  };
  compter();

  formulaire.hidden = !moi.joueur;
  carte.querySelector('.commentaires-connexion').hidden = Boolean(moi.joueur);

  bouton.addEventListener('click', async () => {
    zone.hidden = !zone.hidden;
    bouton.setAttribute('aria-expanded', String(!zone.hidden));
    if (zone.hidden || charges) return;
    try {
      const { commentaires } = await api(`/api/resultats/${publication.id}/commentaires`);
      liste.replaceChildren(...commentaires.map(construireCommentaire));
      charges = true;
      chargement.hidden = true;
    } catch (erreur) {
      chargement.textContent = erreur.message;
    }
  });

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const contenu = champ.value.trim();
    if (!contenu) return;
    champ.disabled = true;
    try {
      const { commentaire } = await api(`/api/resultats/${publication.id}/commentaires`, { method: 'POST', corps: { texte: contenu } });
      liste.append(construireCommentaire(commentaire));
      publication.nbCommentaires += 1;
      compter();
      champ.value = '';
    } catch (erreur) {
      afficherMessage(erreur.message);
    } finally {
      champ.disabled = false;
      champ.focus();
    }
  });
}

document.querySelectorAll('.onglet').forEach((onglet) => {
  onglet.addEventListener('click', () => {
    tri = onglet.dataset.tri;
    chargerMur();
  });
});

// ---------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------

async function demarrer() {
  const parametres = new URLSearchParams(location.search);
  const erreur = parametres.get('erreur');
  if (erreur) afficherMessage(MESSAGES_ERREUR[erreur] ?? 'Une erreur est survenue.');
  if (parametres.get('bienvenue')) afficherMessage('🎉 Bienvenue ! Tu as rejoint le serveur Discord du jeu.');

  try {
    moi = await api('/api/moi');
  } catch {
    afficherMessage('Impossible de joindre le serveur du jeu. Est-il lancé ?');
    return;
  }
  // Session expirée (ou relais réinitialisé) : on oublie le vieux jeton.
  if (!moi.joueur) oublierSession();
  afficherCompte();

  if (!moi.murDisponible) {
    afficherMessage(`Le mur des mandats n'est pas encore relié à Discord. Réglages manquants dans .env : ${moi.reglagesManquants.join(', ')}.`);
    return;
  }

  afficherAPublier();
  await chargerMur();
  if (location.hash === '#publier' && !element('a-publier').hidden) element('a-publier').scrollIntoView({ behavior: 'smooth' });
}

demarrer();
