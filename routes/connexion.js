// =====================================================================
// routes/connexion.js — Connexion avec Discord, pour le serveur Node (Express).
// La logique est dans api/connexion.js (partagée avec le relais Cloudflare).
//  GET  /auth/discord           → part vers Discord (page « Autoriser »)
//  GET  /auth/discord/callback  → retour de Discord : on ouvre la session
//  POST /auth/deconnexion       → on ferme la session
//  GET  /api/moi                → qui est connecté ? (et ce qui est configuré)
// =====================================================================

import express from 'express';
import * as connexion from '../api/connexion.js';
import { lireCookies, effacerCookie } from '../discord/session.js';
import { joueurConnecte, memeOrigine, repondre, redirigerAvecCookies } from './outils.js';

export const routesConnexion = express.Router();

routesConnexion.get('/auth/discord', (req, res) => {
  redirigerAvecCookies(res, connexion.debut(req.query.retour));
});

routesConnexion.get('/auth/discord/callback', async (req, res) => {
  redirigerAvecCookies(res, await connexion.retour(req.query, lireCookies(req).oauth_etat));
});

routesConnexion.post('/auth/deconnexion', memeOrigine, (req, res) => {
  effacerCookie(res, 'session');
  res.json({ ok: true });
});

routesConnexion.get('/api/moi', (req, res) => {
  repondre(res, connexion.moi(joueurConnecte(req)));
});
