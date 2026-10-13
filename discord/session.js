// =====================================================================
// session.js — Se souvenir de qui est connecté, sans base de données.
//
// Après la connexion Discord, on donne au navigateur un « cookie signé » :
// il contient l'identité du joueur ({ id, nom, avatar }) et une signature
// calculée avec SESSION_SECRET. Si quelqu'un modifie le cookie, la signature
// ne correspond plus et il est refusé. Rien n'est stocké côté serveur :
// la connexion survit même à un redémarrage.
// =====================================================================

import crypto from 'node:crypto';

function signer(valeur, secret) {
  return crypto.createHmac('sha256', secret).update(valeur).digest('base64url');
}

// Fabrique un jeton signé qui expire au bout de dureeSecondes.
export function creerJeton(donnees, secret, dureeSecondes) {
  const corps = Buffer.from(JSON.stringify({ ...donnees, exp: Date.now() + dureeSecondes * 1000 })).toString('base64url');
  return `${corps}.${signer(corps, secret)}`;
}

// Relit un jeton : renvoie les données, ou null s'il est faux, modifié ou expiré.
export function lireJeton(jeton, secret) {
  if (typeof jeton !== 'string' || !secret) return null;
  const [corps, signature] = jeton.split('.');
  if (!corps || !signature) return null;

  // Comparaison « à temps constant » : empêche de deviner la signature petit à petit.
  const recue = Buffer.from(signature);
  const attendue = Buffer.from(signer(corps, secret));
  if (recue.length !== attendue.length || !crypto.timingSafeEqual(recue, attendue)) return null;

  try {
    const donnees = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8'));
    return donnees.exp > Date.now() ? donnees : null;
  } catch {
    return null;
  }
}

// Lit les cookies envoyés par le navigateur : « a=1; b=2 » → { a: '1', b: '2' }
export function lireCookies(req) {
  const cookies = {};
  for (const morceau of (req.get('cookie') ?? '').split(';')) {
    const position = morceau.indexOf('=');
    if (position > 0) cookies[morceau.slice(0, position).trim()] = decodeURIComponent(morceau.slice(position + 1).trim());
  }
  return cookies;
}

// HttpOnly : le JavaScript de la page ne peut pas lire le cookie (protège des vols).
// SameSite=Lax : un autre site ne peut pas envoyer de formulaire en se faisant passer pour toi.
// Secure : seulement si le site est en https (pas en local).
export function ecrireCookie(res, nom, valeur, dureeSecondes, securise) {
  const options = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${dureeSecondes}`];
  if (securise) options.push('Secure');
  res.append('Set-Cookie', `${nom}=${encodeURIComponent(valeur)}; ${options.join('; ')}`);
}

export function effacerCookie(res, nom) {
  res.append('Set-Cookie', `${nom}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
