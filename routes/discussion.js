// =====================================================================
// routes/discussion.js — La page « Discussion », pour le serveur Node (Express).
// La logique est dans api/discussion.js (partagée avec le relais Cloudflare).
//  GET  /api/discussion/themes   → la liste des thèmes
//  POST /api/discussion          → la réponse de l'IA, envoyée au fur et à mesure
//  POST /api/discussion/decision → le joueur vient-il de prendre une décision ?
// =====================================================================

import express from 'express';
import * as discussion from '../api/discussion.js';
import { memeOrigine, repondre } from './outils.js';

export const routesDiscussion = express.Router();

routesDiscussion.get('/api/discussion/themes', (req, res) => repondre(res, discussion.themes()));

routesDiscussion.post('/api/discussion', memeOrigine, async (req, res) => {
  const resultat = await discussion.discuter(req.body, req.ip);
  if (!resultat.flux) return repondre(res, resultat);

  // Le texte est envoyé morceau par morceau, au fur et à mesure que l'IA l'écrit.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  for await (const morceau of resultat.flux) res.write(morceau);
  res.end();
});

routesDiscussion.post('/api/discussion/decision', memeOrigine, async (req, res) => {
  repondre(res, await discussion.decision(req.body));
});
