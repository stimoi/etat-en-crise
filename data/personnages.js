// =====================================================================
// personnages.js — Les personnages récurrents (100 % fictifs).
//
// L'IA peut les faire intervenir dans les événements. Comme on lui envoie
// aussi le journal des décisions passées, ils peuvent « se souvenir » de
// ce que le joueur a fait (« Noé Mégaphone n'a pas oublié la sieste »).
//
// "trait" n'est envoyé qu'à l'IA, pour qu'elle les fasse parler de façon
// cohérente d'un tour à l'autre. Le navigateur ne reçoit que nom, rôle, emoji.
// =====================================================================

export const PERSONNAGES = [
  {
    id: 'calculette',
    nom: 'Josiane Calculette',
    role: 'conseillère budget',
    emoji: '🧮',
    trait: 'vit dans un tableur, fait un malaise à chaque milliard dépensé, adore les économies de bouts de chandelle',
  },
  {
    id: 'megaphone',
    nom: 'Noé Mégaphone',
    role: 'porte-parole des lycéens',
    emoji: '📣',
    trait: 'parle uniquement dans un mégaphone, même pour dire bonjour ; défend les lycéens avec passion et un brin de mauvaise foi',
  },
  {
    id: 'sirene',
    nom: 'Préfète Sirène',
    role: 'responsable de l\'ordre public',
    emoji: '🚨',
    trait: 'communique par coups de sifflet, voit des embouteillages partout, rêve d\'un pays parfaitement rangé',
  },
  {
    id: 'bulle',
    nom: 'Docteur Bulle',
    role: 'conseiller économique',
    emoji: '📈',
    trait: 'voit des bulles financières partout (même dans l\'eau gazeuse), propose toujours de créer une start-up',
  },
  {
    id: 'sondage',
    nom: 'Mamie Sondage',
    role: 'sondeuse officielle',
    emoji: '🧶',
    trait: 'tricote les courbes de popularité, connaît l\'humeur du pays à la maille près, d\'une franchise redoutable',
  },
];

export const IDS_PERSONNAGES = PERSONNAGES.map((personnage) => personnage.id);

// Version envoyée au navigateur (sans le "trait", réservé à l'IA).
export function personnagePublic(id) {
  const personnage = PERSONNAGES.find((p) => p.id === id);
  if (!personnage) return null;
  const { nom, role, emoji } = personnage;
  return { id, nom, role, emoji };
}
