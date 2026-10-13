// =====================================================================
// routes/jeu.js — Les routes du jeu, pour le serveur Node (Express).
// La logique est dans api/jeu.js (partagée avec le relais Cloudflare).
//  POST /api/evenement   → l'événement du tour (toujours valide) ;
//  POST /api/choix-libre → évaluer une décision écrite par le joueur ;
//  POST /api/bilan       → le verdict de l'Histoire en fin de partie.
// =====================================================================

import express from 'express';
import * as jeu from '../api/jeu.js';
import { repondre } from './outils.js';

export const routesJeu = express.Router();

routesJeu.post('/api/evenement', async (req, res) => repondre(res, await jeu.evenement(req.body)));
routesJeu.post('/api/choix-libre', async (req, res) => repondre(res, await jeu.choixLibre(req.body)));
routesJeu.post('/api/bilan', async (req, res) => repondre(res, await jeu.bilan(req.body)));
