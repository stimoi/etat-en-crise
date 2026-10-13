// =====================================================================
// mur.js — Le « mur des mandats », stocké sur ton serveur Discord.
//
// Discord sert de base de données, et tout reste lisible par les humains :
//  - salon RÉSULTATS : une publication = un message du bot (une jolie « carte ») ;
//  - fil sous chaque publication : les commentaires (un message du bot chacun) ;
//  - salon VOTES (privé) : un vote = une petite ligne JSON {"p": publication, "u": joueur, "v": 1 | -1 | 0}.
//    On n'efface jamais un vote : le DERNIER vote d'un joueur sur une publication compte.
//
// Au démarrage, le serveur relit tout ça une fois et le garde en mémoire :
// l'affichage est instantané, et chaque nouvelle action est écrite sur Discord
// AVANT d'être ajoutée en mémoire (si Discord refuse, rien n'est perdu ni faussé).
//
// Sécurité : on ne croit QUE les messages écrits par notre bot. Un membre du
// serveur qui taperait un faux vote dans le salon serait simplement ignoré.
// =====================================================================

import { appelBot, listerMessages } from './api.js';
import { configDiscord, stockageConfigure } from './config.js';

const COULEUR = 0x2346c4; // le bleu du jeu
const PAS_DE_MENTIONS = { parse: [] }; // un texte avec « @everyone » ne notifiera personne

export const LIBELLES_CAUSES = {
  dette: 'Faillite (dette)',
  popularite: 'Popularité à zéro',
  economie: 'Économie effondrée',
  ordre: 'Chaos (ordre public)',
};

const memoire = {
  chargement: null, // promesse du chargement initial
  chargeLe: 0, // quand le mur a été lu sur Discord pour la dernière fois
  botId: null,
  publications: new Map(), // id → publication
  votes: new Map(), // id de publication → Map(id du joueur → 1 | -1)
  commentaires: new Map(), // id de publication → [commentaires] (lus à la demande)
};

// ---------------------------------------------------------------------
// Chargement initial depuis Discord
// ---------------------------------------------------------------------

// Lance le chargement (une seule fois) et renvoie la promesse correspondante.
// DUREE_CACHE_MUR (en secondes) : au-delà, on relit tout sur Discord.
//  - serveur Node : vide → lu une seule fois (le serveur est le seul à écrire) ;
//  - relais Cloudflare : 15 s, car plusieurs copies du relais peuvent tourner en
//    même temps : chacune revoit régulièrement ce que les autres ont écrit.
export function initialiserMur() {
  if (!stockageConfigure()) return Promise.reject(new Error('Mur non configuré'));
  const dureeCache = Number(process.env.DUREE_CACHE_MUR) * 1000;
  if (memoire.chargement && dureeCache > 0 && Date.now() - memoire.chargeLe > dureeCache) {
    memoire.chargement = null;
  }
  if (!memoire.chargement) {
    memoire.chargement = charger().catch((erreur) => {
      memoire.chargement = null; // on réessaiera à la prochaine demande
      throw erreur;
    });
  }
  return memoire.chargement;
}

async function charger() {
  const { salonResultats, salonVotes } = configDiscord();
  if (!memoire.botId) memoire.botId = (await appelBot('GET', '/users/@me')).id;

  // On remplit des listes NEUVES, puis on les échange d'un coup : pendant une
  // relecture, les visiteurs continuent de voir l'ancienne version complète.
  const publications = new Map();
  for (const message of await listerMessages(salonResultats)) {
    const publication = lirePublication(message);
    if (publication) publications.set(publication.id, publication);
  }

  // Les votes, du plus ancien au plus récent : le dernier vote d'un joueur l'emporte.
  const votes = new Map();
  for (const message of (await listerMessages(salonVotes)).reverse()) {
    if (message.author?.id !== memoire.botId) continue;
    try {
      const { p, u, v } = JSON.parse(message.content);
      enregistrerVote(p, u, v, votes);
    } catch {
      // ligne illisible : ignorée
    }
  }

  memoire.publications = publications;
  memoire.votes = votes;
  memoire.commentaires = new Map(); // relus à la demande
  memoire.chargeLe = Date.now();

  console.log(`🏆 Mur des mandats chargé depuis Discord : ${memoire.publications.size} publication(s).`);
}

// ---------------------------------------------------------------------
// Format des messages : on écrit une « carte » (embed) lisible sur Discord,
// et on glisse les données utiles au jeu dans son pied de page (JSON compact).
// ---------------------------------------------------------------------

const formatDette = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function construireCarte(utilisateur, donnees) {
  const champs = [
    { name: 'Tours tenus', value: String(donnees.tours), inline: true },
    { name: 'Fin', value: LIBELLES_CAUSES[donnees.cause], inline: true },
    { name: 'Dette finale', value: `${formatDette.format(donnees.dette)} Md€`, inline: true },
    { name: 'Période', value: donnees.periode || '—', inline: true },
  ];
  if (donnees.reformes.length) champs.push({ name: 'Grandes réformes', value: donnees.reformes.join('\n') });
  if (donnees.message) champs.push({ name: 'Mot de l\'auteur', value: donnees.message });

  return {
    title: `« ${donnees.titre} »`,
    description: donnees.resume,
    color: COULEUR,
    author: { name: utilisateur.nom, icon_url: utilisateur.avatar },
    fields: champs,
    footer: {
      text: `🎮 L'État en crise · ${JSON.stringify({
        a: utilisateur.id, t: donnees.tours, c: donnees.cause, d: donnees.dette, p: donnees.periode, f: donnees.reformes,
      })}`,
    },
    timestamp: new Date().toISOString(),
  };
}

// Données cachées dans le pied de page : ce qui suit la première « { ».
function lireDonneesPied(embed) {
  const texte = embed?.footer?.text ?? '';
  const debut = texte.indexOf('{');
  if (debut === -1) return null;
  try {
    return JSON.parse(texte.slice(debut));
  } catch {
    return null;
  }
}

// Message Discord → publication du jeu (ou null si ce n'en est pas une).
function lirePublication(message) {
  if (message.author?.id !== memoire.botId) return null;
  const embed = message.embeds?.[0];
  const donnees = lireDonneesPied(embed);
  if (!donnees?.a) return null;
  const champ = (nom) => embed.fields?.find((f) => f.name === nom)?.value ?? '';
  return {
    id: message.id,
    auteur: { id: donnees.a, nom: embed.author?.name ?? 'Anonyme', avatar: embed.author?.icon_url ?? null },
    titre: (embed.title ?? '').replace(/^« /, '').replace(/ »$/, ''),
    resume: embed.description ?? '',
    message: champ('Mot de l\'auteur'),
    tours: donnees.t,
    cause: donnees.c,
    dette: donnees.d,
    periode: donnees.p ?? '',
    reformes: Array.isArray(donnees.f) ? donnees.f : [],
    date: message.timestamp,
    // Un fil créé à partir d'un message a le même identifiant que lui.
    aUnFil: Boolean(message.thread),
    nbCommentaires: message.thread?.message_count ?? 0,
  };
}

function lireCommentaire(message) {
  if (message.author?.id !== memoire.botId) return null;
  const embed = message.embeds?.[0];
  const donnees = lireDonneesPied(embed);
  if (!donnees?.a) return null;
  return {
    id: message.id,
    auteur: { id: donnees.a, nom: embed.author?.name ?? 'Anonyme', avatar: embed.author?.icon_url ?? null },
    texte: embed.description ?? '',
    date: message.timestamp,
  };
}

function enregistrerVote(publicationId, joueurId, valeur, tousLesVotes = memoire.votes) {
  if (!tousLesVotes.has(publicationId)) tousLesVotes.set(publicationId, new Map());
  const votes = tousLesVotes.get(publicationId);
  if (valeur === 1 || valeur === -1) votes.set(joueurId, valeur);
  else votes.delete(joueurId);
}

function trouverPublication(id) {
  const publication = memoire.publications.get(id);
  if (!publication) {
    const erreur = new Error('Publication introuvable');
    erreur.statut = 404;
    throw erreur;
  }
  return publication;
}

// ---------------------------------------------------------------------
// Ce que le site peut demander
// ---------------------------------------------------------------------

// Toutes les publications, avec les compteurs et le vote du joueur connecté.
export async function listerPublications(joueurId, tri = 'recent') {
  await initialiserMur();
  const liste = [...memoire.publications.values()].map((publication) => {
    const votes = [...(memoire.votes.get(publication.id)?.values() ?? [])];
    return {
      ...publication,
      causeLibelle: LIBELLES_CAUSES[publication.cause] ?? publication.cause,
      likes: votes.filter((v) => v === 1).length,
      dislikes: votes.filter((v) => v === -1).length,
      monVote: joueurId ? memoire.votes.get(publication.id)?.get(joueurId) ?? 0 : 0,
    };
  });
  return liste.sort(tri === 'top'
    ? (a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes) || b.date.localeCompare(a.date)
    : (a, b) => b.date.localeCompare(a.date));
}

export async function publier(utilisateur, donnees) {
  await initialiserMur();
  const { salonResultats } = configDiscord();
  const message = await appelBot('POST', `/channels/${salonResultats}/messages`, {
    embeds: [construireCarte(utilisateur, donnees)],
    allowed_mentions: PAS_DE_MENTIONS,
  });
  const publication = lirePublication(message);
  memoire.publications.set(publication.id, publication);
  return publication;
}

export async function voter(utilisateur, publicationId, valeur) {
  await initialiserMur();
  trouverPublication(publicationId);
  const actuel = memoire.votes.get(publicationId)?.get(utilisateur.id) ?? 0;
  if (actuel !== valeur) {
    await appelBot('POST', `/channels/${configDiscord().salonVotes}/messages`, {
      content: JSON.stringify({ p: publicationId, u: utilisateur.id, v: valeur }),
      allowed_mentions: PAS_DE_MENTIONS,
    });
    enregistrerVote(publicationId, utilisateur.id, valeur);
  }
  const votes = [...memoire.votes.get(publicationId)?.values() ?? []];
  return { likes: votes.filter((v) => v === 1).length, dislikes: votes.filter((v) => v === -1).length, monVote: valeur };
}

// Commentaires d'une publication, lus sur Discord la première fois puis gardés en mémoire.
export async function listerCommentaires(publicationId) {
  await initialiserMur();
  const publication = trouverPublication(publicationId);
  if (!memoire.commentaires.has(publicationId)) {
    const messages = publication.aUnFil ? await listerMessages(publicationId) : [];
    memoire.commentaires.set(publicationId, messages.map(lireCommentaire).filter(Boolean).reverse());
  }
  return memoire.commentaires.get(publicationId);
}

export async function commenter(utilisateur, publicationId, texte) {
  const commentaires = await listerCommentaires(publicationId);
  const publication = trouverPublication(publicationId);

  // Premier commentaire : on ouvre un fil sous la publication.
  if (!publication.aUnFil) {
    try {
      await appelBot('POST', `/channels/${configDiscord().salonResultats}/messages/${publicationId}/threads`, {
        name: `💬 ${publication.titre}`.slice(0, 100),
        auto_archive_duration: 10080, // le fil se range après 7 jours d'inactivité (il reste lisible)
      });
    } catch (erreur) {
      if (erreur.codeDiscord !== 160004) throw erreur; // 160004 = le fil existe déjà : très bien
    }
    publication.aUnFil = true;
  }

  const message = await appelBot('POST', `/channels/${publicationId}/messages`, {
    embeds: [{
      author: { name: utilisateur.nom, icon_url: utilisateur.avatar },
      description: texte,
      color: COULEUR,
      footer: { text: `💬 ${JSON.stringify({ a: utilisateur.id })}` },
      timestamp: new Date().toISOString(),
    }],
    allowed_mentions: PAS_DE_MENTIONS,
  });
  const commentaire = lireCommentaire(message);
  commentaires.push(commentaire);
  publication.nbCommentaires += 1;
  return commentaire;
}
