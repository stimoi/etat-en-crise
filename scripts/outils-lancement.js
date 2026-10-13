// =====================================================================
// outils-lancement.js — Petits outils partagés par les deux lanceurs :
//   « npm run local »     (scripts/lancer-local.js)
//   « npm run craftpick » (scripts/lancer-craftpick.js)
// =====================================================================

import path from 'node:path';
import { spawn } from 'node:child_process';

export const RACINE = path.join(import.meta.dirname, '..');

const attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

// Le serveur IA répond-il ? (route /api/version d'Ollama, très rapide)
export async function serveurRepond(url, delaiMs = 3000) {
  try {
    const reponse = await fetch(`${url.replace(/\/$/, '')}/api/version`, { signal: AbortSignal.timeout(delaiMs) });
    return reponse.ok;
  } catch {
    return false;
  }
}

// Attend que le serveur IA réponde, en réessayant toutes les demi-secondes.
export async function attendreServeur(url, delaiMaxMs) {
  const limite = Date.now() + delaiMaxMs;
  while (Date.now() < limite) {
    if (await serveurRepond(url, 1000)) return true;
    await attendre(500);
  }
  return false;
}

// Liste des modèles installés sur un serveur Ollama.
export async function listerModeles(url) {
  try {
    const reponse = await fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const donnees = await reponse.json();
    return (donnees.models ?? []).map((modele) => modele.name);
  } catch {
    return [];
  }
}

// Envoie une toute petite question au modèle pour vérifier qu'il répond vraiment
// (un modèle « cloud » peut exister mais refuser de répondre si on n'est pas connecté).
// Renvoie { ok: true, duree } ou { ok: false, raison }.
export async function testerModele(url, modele, cle) {
  const debut = Date.now();
  try {
    const reponse = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cle && { Authorization: `Bearer ${cle}` }) },
      body: JSON.stringify({
        model: modele,
        messages: [{ role: 'user', content: 'Réponds seulement : OK' }],
        stream: false,
        think: false,
        options: { num_predict: 5 },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!reponse.ok) {
      return { ok: false, raison: `code ${reponse.status} : ${(await reponse.text()).slice(0, 200)}` };
    }
    return { ok: true, duree: ((Date.now() - debut) / 1000).toFixed(1) };
  } catch (erreur) {
    return { ok: false, raison: erreur.message };
  }
}

// Lance une commande et attend qu'elle se termine. Renvoie son code de sortie.
export function executer(commande, args) {
  return new Promise((resoudre) => {
    const processus = spawn(commande, args, { stdio: 'inherit' });
    processus.on('error', () => resoudre(-1)); // commande introuvable
    processus.on('exit', (code) => resoudre(code ?? -1));
  });
}

// Lance le serveur du jeu avec les réglages d'IA choisis.
// Ces réglages passent AVANT ceux du fichier .env : server.js ne les écrase pas.
// avantArret : fonction appelée quand le jeu s'arrête (ex. arrêter Ollama).
// page : la page à ouvrir dans le navigateur (ex. « /etat-en-crise.html »).
export function lancerJeu(reglagesIA, avantArret = () => {}, { page = '/' } = {}) {
  const jeu = spawn(process.execPath, ['server.js'], {
    cwd: RACINE,
    stdio: 'inherit',
    env: { ...process.env, ...reglagesIA },
  });

  const arreter = () => {
    jeu.kill();
    avantArret();
  };
  // Ctrl+C dans le terminal : on arrête proprement tout ce qu'on a lancé.
  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
  jeu.on('exit', (code) => {
    avantArret();
    process.exit(code ?? 0);
  });

  // Lancé depuis un fichier .bat (double-clic) : on ouvre le navigateur dès que le jeu répond.
  if (process.env.OUVRIR_NAVIGATEUR === '1') ouvrirNavigateurQuandPret(page);
}

async function ouvrirNavigateurQuandPret(page) {
  const adresse = `http://localhost:${process.env.PORT || 3000}${page}`;
  const limite = Date.now() + 15000;
  while (Date.now() < limite) {
    try {
      if ((await fetch(adresse, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {
      // pas encore prêt
    }
    await attendre(300);
  }
  // Commande d'ouverture d'une adresse selon le système (Windows, macOS, Linux).
  const [commande, args] = process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '', adresse]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [adresse]];
  spawn(commande, args, { stdio: 'ignore', detached: true }).unref();
}
