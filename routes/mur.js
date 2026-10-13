// =====================================================================
// routes/mur.js — Le « mur des mandats », pour le serveur Node (Express).
// La logique est dans api/mur.js (partagée avec le relais Cloudflare).
//  GET  /api/resultats                     → toutes les publications (?tri=recent|top)
//  POST /api/resultats                     → publier son résultat (connecté)
//  POST /api/resultats/:id/vote            → liker / disliker / annuler (connecté)
//  GET  /api/resultats/:id/commentaires    → lire les commentaires
//  POST /api/resultats/:id/commentaires    → commenter (connecté)
// =====================================================================

import express from 'express';
import * as mur from '../api/mur.js';
import { joueurConnecte, memeOrigine, repondre } from './outils.js';

export const routesMur = express.Router();

routesMur.get('/api/resultats', async (req, res) => {
  repondre(res, await mur.lister(req.query.tri, joueurConnecte(req)));
});

routesMur.post('/api/resultats', memeOrigine, async (req, res) => {
  repondre(res, await mur.publierResultat(req.body, joueurConnecte(req)));
});

routesMur.post('/api/resultats/:id/vote', memeOrigine, async (req, res) => {
  repondre(res, await mur.voterResultat(req.params.id, req.body, joueurConnecte(req)));
});

routesMur.get('/api/resultats/:id/commentaires', async (req, res) => {
  repondre(res, await mur.lireCommentaires(req.params.id));
});

routesMur.post('/api/resultats/:id/commentaires', memeOrigine, async (req, res) => {
  repondre(res, await mur.commenterResultat(req.params.id, req.body, joueurConnecte(req)));
});
