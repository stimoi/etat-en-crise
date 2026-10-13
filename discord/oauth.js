// =====================================================================
// oauth.js — « Se connecter avec Discord » (OAuth2).
//
// Le chemin d'une connexion :
//  1. le jeu envoie le joueur sur la page d'autorisation de Discord ;
//  2. le joueur accepte, Discord le renvoie sur /auth/discord/callback avec un « code » ;
//  3. le serveur échange ce code contre un jeton d'accès (avec le secret de l'application) ;
//  4. avec ce jeton, il lit le profil du joueur (pseudo, avatar) ;
//  5. si l'ajout automatique est activé, le bot ajoute le joueur à ton serveur Discord ;
//  puis le jeton est oublié.
//
// Permissions demandées (affichées par Discord sur la page d'autorisation) :
//  - « identify » : le pseudo et l'avatar seulement (ni e-mail, ni liste de serveurs) ;
//  - « guilds.join » (si DISCORD_SERVEUR_ID est rempli) : « Rejoindre des serveurs pour toi »,
//    utilisé UNIQUEMENT pour ajouter le joueur au serveur du jeu.
// =====================================================================

import { configDiscord } from './config.js';
import { appelFormulaire, appelJoueur, appelBot } from './api.js';

export function urlAutorisation(etat) {
  const { urlSite, clientId, redirection, ajoutAutomatique } = configDiscord();
  const parametres = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirection,
    scope: ajoutAutomatique ? 'identify guilds.join' : 'identify',
    state: etat, // valeur au hasard, revérifiée au retour (empêche les fausses connexions)
    prompt: 'none', // pas besoin de ré-accepter à chaque fois
  });
  return `${urlSite}/oauth2/authorize?${parametres}`;
}

// Étapes 3 à 5. Renvoie { joueur: { id, nom, avatar }, serveur }
// serveur : 'ajoute' (nouveau membre), 'deja-membre', 'echec' ou null (ajout désactivé).
export async function connecterAvecCode(code) {
  const { clientId, clientSecret, redirection, ajoutAutomatique } = configDiscord();
  const jeton = await appelFormulaire('/oauth2/token', {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirection,
  });
  const profil = await appelJoueur(jeton.access_token, '/users/@me');
  const joueur = {
    id: profil.id,
    nom: profil.global_name || profil.username,
    avatar: urlAvatar(profil),
  };

  // Le joueur a pu refuser la permission « Rejoindre des serveurs » : on vérifie.
  const autorise = typeof jeton.scope === 'string' && jeton.scope.split(' ').includes('guilds.join');
  const serveur = ajoutAutomatique && autorise ? await ajouterAuServeur(joueur, jeton.access_token) : null;
  return { joueur, serveur };
}

// Le bot ajoute le joueur au serveur (le bot doit y être, avec la permission
// « Créer une invitation »). Un échec n'empêche JAMAIS la connexion au site.
async function ajouterAuServeur(joueur, jetonAcces) {
  const { serveurId } = configDiscord();
  try {
    // Discord répond 201 (avec le membre) s'il l'ajoute, 204 (vide) s'il y était déjà.
    const membre = await appelBot('PUT', `/guilds/${serveurId}/members/${joueur.id}`, { access_token: jetonAcces });
    if (membre) console.log(`🎉 ${joueur.nom} a rejoint le serveur Discord.`);
    return membre ? 'ajoute' : 'deja-membre';
  } catch (erreur) {
    // 403 : le bot n'a pas la permission « Créer une invitation », ou le joueur est banni.
    console.warn(`⚠️  Ajout de ${joueur.nom} au serveur Discord impossible : ${erreur.message}`);
    return 'echec';
  }
}

// Adresse de l'image d'avatar (ou de l'avatar par défaut de Discord).
export function urlAvatar({ id, avatar }) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`;
  const index = Number((BigInt(id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
