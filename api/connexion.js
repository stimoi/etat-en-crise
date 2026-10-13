// =====================================================================
// api/connexion.js — Le cœur de la connexion avec Discord (sans Express).
//  debut(retour)                → départ vers Discord (page « Autoriser »)
//  retour(requete, cookieEtat)  → retour de Discord : on ouvre la session
//  moi(joueur)                  → qui est connecté ? (et ce qui est configuré)
//
// Deux modes :
//  - serveur Node (le site et l'API à la même adresse) : la session est un cookie ;
//  - relais pour GitHub Pages (ORIGINE_SITE rempli) : le site et le relais ont
//    deux adresses différentes, et les navigateurs bloquent les cookies entre
//    sites. La session est alors renvoyée au site dans la partie « # » de
//    l'adresse (jamais envoyée aux serveurs ni enregistrée dans les journaux),
//    puis le site la renvoie dans l'en-tête « Authorization » de chaque requête.
// =====================================================================

import crypto from 'node:crypto';
import { configDiscord, connexionConfiguree, stockageConfigure, reglagesManquants } from '../discord/config.js';
import { urlAutorisation, connecterAvecCode } from '../discord/oauth.js';
import { creerJeton, lireJeton } from '../discord/session.js';
import { ok } from './outils.js';

export const DUREE_SESSION = 30 * 24 * 3600; // 30 jours
export const DUREE_ETAT = 10 * 60; // 10 minutes pour revenir de Discord

// Le joueur n'est renvoyé que vers une page DU SITE, jamais vers une adresse
// extérieure qu'un petit malin aurait glissée dans le lien.
export function pageDeRetour(valeur) {
  const { origineSite } = configDiscord();
  if (origineSite) {
    try {
      const adresse = new URL(valeur);
      if (adresse.origin === origineSite) return adresse.toString();
    } catch {
      // adresse illisible : page d'accueil du site
    }
    return `${origineSite}/`;
  }
  return typeof valeur === 'string' && /^\/(?![/\\])[\w\-./?=#&]*$/.test(valeur) ? valeur : '/resultats.html';
}

// « /page.html#publier » + « bienvenue=1 » → « /page.html?bienvenue=1#publier »
export function ajouterParametre(adresse, parametre) {
  const [chemin, ancre] = adresse.split('#');
  const avecParametre = `${chemin}${chemin.includes('?') ? '&' : '?'}${parametre}`;
  return ancre === undefined ? avecParametre : `${avecParametre}#${ancre}`;
}

// « https://site/page#publier » + jeton → « https://site/page#publier&session=JETON »
function ajouterSession(adresse, jeton) {
  const [chemin, ancre] = adresse.split('#');
  return `${chemin}#${ancre ? `${ancre}&` : ''}session=${jeton}`;
}

const securise = () => configDiscord().redirection.startsWith('https://');

// Réponse de redirection : { redirection, cookies: [{ nom, valeur, duree, securise }] }
// (duree 0 = effacer le cookie)
const rediriger = (redirection, cookies = []) => ({ redirection, cookies });

export function debut(retourDemande) {
  const retourPropre = pageDeRetour(retourDemande);
  if (!connexionConfiguree()) return rediriger(ajouterParametre(retourPropre, 'erreur=non-configure'));
  // « state » : une valeur au hasard, gardée dans un cookie signé (sur l'adresse
  // du serveur ou du relais), revérifiée au retour : empêche les fausses connexions.
  const etat = crypto.randomBytes(16).toString('hex');
  const jeton = creerJeton({ etat, retour: retourPropre }, configDiscord().secretSession, DUREE_ETAT);
  return rediriger(urlAutorisation(etat), [{ nom: 'oauth_etat', valeur: jeton, duree: DUREE_ETAT, securise: securise() }]);
}

// requete : { state, code, error } (les paramètres de l'adresse de retour)
export async function retour(requete, cookieEtat) {
  const { secretSession, origineSite } = configDiscord();
  const attendu = lireJeton(cookieEtat, secretSession);
  const effacerEtat = { nom: 'oauth_etat', valeur: '', duree: 0 };

  if (!attendu || requete.state !== attendu.etat) {
    return rediriger(ajouterParametre(pageDeRetour(null), 'erreur=connexion'), [effacerEtat]);
  }
  if (requete.error || typeof requete.code !== 'string') {
    return rediriger(ajouterParametre(attendu.retour, 'erreur=annule'), [effacerEtat]);
  }

  try {
    const { joueur, serveur } = await connecterAvecCode(requete.code);
    const jetonSession = creerJeton(joueur, secretSession, DUREE_SESSION);
    console.log(`👤 Connexion Discord : ${joueur.nom}`);
    // Nouveau membre du serveur Discord : la page affichera un message de bienvenue.
    const destination = serveur === 'ajoute' ? ajouterParametre(attendu.retour, 'bienvenue=1') : attendu.retour;
    if (origineSite) {
      return rediriger(ajouterSession(destination, jetonSession), [effacerEtat]);
    }
    return rediriger(destination, [effacerEtat, { nom: 'session', valeur: jetonSession, duree: DUREE_SESSION, securise: securise() }]);
  } catch (probleme) {
    console.warn(`Connexion Discord échouée : ${probleme.message}`);
    return rediriger(ajouterParametre(attendu.retour, 'erreur=connexion'), [effacerEtat]);
  }
}

export function moi(joueur) {
  return ok({
    joueur,
    connexionPossible: connexionConfiguree(),
    murDisponible: stockageConfigure(),
    // Pour prévenir le joueur AVANT qu'il clique : la connexion l'ajoute au serveur Discord.
    ajoutServeur: configDiscord().ajoutAutomatique,
    // Pour aider à configurer : uniquement les NOMS des réglages vides, jamais leurs valeurs.
    reglagesManquants: reglagesManquants(),
  });
}

