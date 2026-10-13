// =====================================================================
// serveur.js — Comment les pages parlent au serveur du jeu.
//
// Deux situations :
//  - serveur Node (lancer-*.bat) : le site et l'API sont à la même adresse,
//    la session est un cookie géré par le navigateur. Rien de spécial à faire.
//  - GitHub Pages : le site n'est qu'un fichier, et l'API est le relais
//    Cloudflare, à une AUTRE adresse (window.API_RELAIS, glissée dans la page
//    par « npm run pages »). Les navigateurs bloquent les cookies entre deux
//    sites : la session est donc gardée ici (localStorage) et envoyée dans
//    l'en-tête « Authorization » de chaque requête.
// =====================================================================

const RELAIS = String(window.API_RELAIS || '').replace(/\/$/, '');
const CLE_SESSION = 'etat-en-crise:session';
// Posé juste avant de partir vers Discord : seule une connexion lancée DEPUIS
// cet onglet peut ramener une session (un lien piégé « #session=... » envoyé
// par quelqu'un d'autre est ignoré).
const CLE_CONNEXION_EN_COURS = 'etat-en-crise:connexion-en-cours';

export const surRelais = Boolean(RELAIS);

// Le stockage du navigateur peut être bloqué (navigation privée stricte) : on ne plante jamais.
function lireStockage(stockage, cle) {
  try {
    return stockage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(stockage, cle, valeur) {
  try {
    if (valeur === null) stockage.removeItem(cle);
    else stockage.setItem(cle, valeur);
  } catch {
    // rien à faire : la session ne durera que le temps de la page
  }
}

export function oublierSession() {
  ecrireStockage(localStorage, CLE_SESSION, null);
}

// Retour de Discord : le relais a mis la session dans l'adresse
// (« ...#publier&session=JETON »). On la range, puis on l'efface de l'adresse
// (pour qu'elle ne reste ni à l'écran, ni dans l'historique, ni dans un lien copié).
function recupererSession() {
  const morceaux = location.hash.slice(1).split('&');
  const morceau = morceaux.find((m) => m.startsWith('session='));
  if (!morceau) return;
  if (surRelais && lireStockage(sessionStorage, CLE_CONNEXION_EN_COURS)) {
    ecrireStockage(localStorage, CLE_SESSION, decodeURIComponent(morceau.slice('session='.length)));
  }
  ecrireStockage(sessionStorage, CLE_CONNEXION_EN_COURS, null);
  const reste = morceaux.filter((m) => m !== morceau).join('&');
  history.replaceState(history.state, '', `${location.pathname}${location.search}${reste ? `#${reste}` : ''}`);
}
recupererSession();

// fetch(), mais vers le bon serveur et avec la session si on en a une.
export function appeler(chemin, options = {}) {
  const jeton = surRelais ? lireStockage(localStorage, CLE_SESSION) : null;
  return fetch(`${RELAIS}${chemin}`, {
    ...options,
    headers: { ...options.headers, ...(jeton && { Authorization: `Bearer ${jeton}` }) },
  });
}

// Adresse du bouton « Se connecter avec Discord ». « retour » : la page où revenir.
// Le relais est ailleurs : il lui faut l'adresse COMPLÈTE de la page (https://...).
export function adresseConnexion(retour) {
  const page = surRelais ? new URL(retour, location.href).href : retour;
  return `${RELAIS}/auth/discord?retour=${encodeURIComponent(page)}`;
}

export function seConnecter(retour) {
  ecrireStockage(sessionStorage, CLE_CONNEXION_EN_COURS, '1');
  location.href = adresseConnexion(retour);
}

export async function seDeconnecter() {
  oublierSession();
  await appeler('/auth/deconnexion', { method: 'POST' }).catch(() => {});
}
