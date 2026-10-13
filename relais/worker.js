// =====================================================================
// relais/worker.js — Le relais Cloudflare Worker (version GitHub Pages).
//
// GitHub Pages ne sert que des fichiers : il ne peut ni garder de secrets,
// ni parler à l'IA en http, ni piloter le bot Discord. Ce petit relais, hébergé
// gratuitement chez Cloudflare, fait exactement ce que faisait le serveur Node :
// il utilise le MÊME cœur (dossier api/). Seule la « plomberie » change :
//  - le site (GitHub Pages) et le relais ont deux adresses différentes : le
//    relais n'accepte que les appels venant du site (règles CORS, ORIGINE_SITE) ;
//  - la session voyage dans l'en-tête « Authorization » (pas de cookie entre sites).
//
// Réglages : secrets du Worker, envoyés par « npm run en-ligne » (scripts/en-ligne.js).
// =====================================================================

import * as jeu from '../api/jeu.js';
import * as mur from '../api/mur.js';
import * as discussion from '../api/discussion.js';
import * as connexion from '../api/connexion.js';
import { joueurDepuis } from '../api/outils.js';

const TAILLE_MAX_CORPS = 50 * 1024; // même limite que le serveur Node
const encodeur = new TextEncoder();

const origineSite = () => (process.env.ORIGINE_SITE || '').replace(/\/$/, '');

// Le relais ne répond qu'au site GitHub Pages (et pas à n'importe quel autre site).
function entetesCors(origine) {
  if (!origine || origine !== origineSite()) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origine,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reponseJson({ statut = 200, json }, cors) {
  return new Response(JSON.stringify(json), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

function reponseRedirection({ redirection, cookies = [] }) {
  const entetes = new Headers({ Location: redirection });
  for (const { nom, valeur, duree } of cookies) {
    // Le relais est toujours en https : cookie « Secure ». Il ne sert qu'à la connexion (state OAuth).
    entetes.append('Set-Cookie', `${nom}=${encodeURIComponent(valeur)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${duree}`);
  }
  return new Response(null, { status: 302, headers: entetes });
}

function lireCookies(requete) {
  const cookies = {};
  for (const morceau of (requete.headers.get('Cookie') ?? '').split(';')) {
    const position = morceau.indexOf('=');
    if (position > 0) cookies[morceau.slice(0, position).trim()] = decodeURIComponent(morceau.slice(position + 1).trim());
  }
  return cookies;
}

// La réponse de l'IA, envoyée morceau par morceau au navigateur.
function reponseEnContinu(flux, cors) {
  const corps = new ReadableStream({
    async pull(controleur) {
      const { value, done } = await flux.next();
      if (done) controleur.close();
      else controleur.enqueue(encodeur.encode(value));
    },
  });
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', ...cors } });
}

async function lireCorps(requete) {
  const taille = Number(requete.headers.get('Content-Length') ?? 0);
  if (taille > TAILLE_MAX_CORPS) return null;
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_CORPS) return null;
  try {
    return JSON.parse(texte || '{}');
  } catch {
    return {};
  }
}

export default {
  async fetch(requete) {
    const url = new URL(requete.url);
    const chemin = url.pathname;
    const origine = requete.headers.get('Origin');
    const cors = entetesCors(origine);

    // Pré-vérification du navigateur avant un appel venant d'un autre site.
    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Un envoi (POST) venant d'un autre site que le nôtre est refusé.
    if (requete.method === 'POST' && origine && origine !== origineSite()) {
      return reponseJson({ statut: 403, json: { erreur: 'Requête refusée.' } }, cors);
    }

    const corps = requete.method === 'POST' ? await lireCorps(requete) : null;
    if (requete.method === 'POST' && corps === null) {
      return reponseJson({ statut: 413, json: { erreur: 'Requête trop grosse.' } }, cors);
    }
    const cookies = lireCookies(requete);
    const joueur = joueurDepuis({ cookie: cookies.session, autorisation: requete.headers.get('Authorization') });
    const cle = requete.headers.get('CF-Connecting-IP') ?? 'inconnu';
    const route = `${requete.method} ${chemin}`;

    // --- Le jeu ---
    if (route === 'POST /api/evenement') return reponseJson(await jeu.evenement(corps), cors);
    if (route === 'POST /api/choix-libre') return reponseJson(await jeu.choixLibre(corps), cors);
    if (route === 'POST /api/bilan') return reponseJson(await jeu.bilan(corps), cors);

    // --- Connexion Discord ---
    if (route === 'GET /api/moi') return reponseJson(connexion.moi(joueur), cors);
    if (route === 'GET /auth/discord') return reponseRedirection(connexion.debut(url.searchParams.get('retour')));
    if (route === 'GET /auth/discord/callback') {
      return reponseRedirection(await connexion.retour(Object.fromEntries(url.searchParams), cookies.oauth_etat));
    }
    // Déconnexion : le site oublie lui-même son jeton ; rien à faire ici.
    if (route === 'POST /auth/deconnexion') return reponseJson({ json: { ok: true } }, cors);

    // --- Mur des mandats ---
    if (route === 'GET /api/resultats') return reponseJson(await mur.lister(url.searchParams.get('tri'), joueur), cors);
    if (route === 'POST /api/resultats') return reponseJson(await mur.publierResultat(corps, joueur), cors);
    const publication = chemin.match(/^\/api\/resultats\/(\d+)\/(vote|commentaires)$/);
    if (publication) {
      const [, id, action] = publication;
      if (action === 'vote' && requete.method === 'POST') return reponseJson(await mur.voterResultat(id, corps, joueur), cors);
      if (action === 'commentaires' && requete.method === 'GET') return reponseJson(await mur.lireCommentaires(id), cors);
      if (action === 'commentaires' && requete.method === 'POST') return reponseJson(await mur.commenterResultat(id, corps, joueur), cors);
    }

    // --- Discussion ---
    if (route === 'GET /api/discussion/themes') return reponseJson(discussion.themes(), cors);
    if (route === 'POST /api/discussion/decision') return reponseJson(await discussion.decision(corps), cors);
    if (route === 'POST /api/discussion') {
      const resultat = await discussion.discuter(corps, cle);
      return resultat.flux ? reponseEnContinu(resultat.flux, cors) : reponseJson(resultat, cors);
    }

    // --- Accueil du relais (pour vérifier qu'il est en ligne) ---
    if (route === 'GET /') {
      return new Response(`Relais de « L'État en crise » : en ligne.\nSite autorisé : ${origineSite() || '(ORIGINE_SITE non réglé)'}\n`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return reponseJson({ statut: 404, json: { erreur: 'Adresse inconnue.' } }, cors);
  },
};
