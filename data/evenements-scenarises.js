// =====================================================================
// evenements-scenarises.js — Le calendrier de l'État.
//
// Des événements écrits à l'avance, qui reviennent chaque année au même
// moment : rentrée en septembre, budget à l'automne, bac en juin...
// Ils se déclenchent au DÉBUT du mois indiqué (1er tour du mois), à la
// place de l'événement de l'IA.
//
// Format : comme les événements de secours, avec en plus "mois" (1 = janvier).
// Les montants sont réalistes : ex. 10 000 enseignants ≈ 0,6 Md€/an ≈ 0,05 Md€/mois.
// =====================================================================

export const EVENEMENTS_SCENARISES = [
  {
    mois: 1,
    titre: 'Vague de grand froid',
    description: 'Il fait -15 °C : les pingouins du zoo demandent l\'asile climatique au Sahara. Les factures de chauffage s\'envolent.',
    choix: [
      { texte: 'Verser un chèque énergie exceptionnel', effets: { popularite: 9, economie: 2, education: 0, ordre: 2 }, budget: { poste: 'solidarite', montantMensuel: 0.6, dureeMois: 2 } },
      { texte: 'Ouvrir les gymnases la nuit pour se réchauffer', effets: { popularite: 5, economie: 0, education: -2, ordre: 4 }, budget: { poste: 'solidarite', montantMensuel: 0.03, dureeMois: 2 } },
      { texte: 'Lancer la campagne « Mettez un deuxième pull »', effets: { popularite: -7, economie: 1, education: 0, ordre: -2 }, budget: null },
    ],
  },
  {
    mois: 2,
    titre: 'Le Salon de l\'agriculture ouvre ses portes',
    description: 'Comme chaque année, une vache de 700 kg vous attend pour la photo officielle. Les agriculteurs, eux, attendent surtout des réponses.',
    choix: [
      { texte: 'Débloquer une aide d\'urgence aux agriculteurs', effets: { popularite: 8, economie: 3, education: 0, ordre: 3 }, budget: { poste: 'autres', montantMensuel: 0.2, dureeMois: 12 } },
      { texte: 'Supprimer trois formulaires sur quatre cents', effets: { popularite: 2, economie: 2, education: 0, ordre: -2 }, budget: null },
      { texte: 'Caresser la vache très longuement devant les caméras', effets: { popularite: 4, economie: -3, education: 0, ordre: -4 }, budget: null },
    ],
  },
  {
    mois: 3,
    titre: 'Le rapport annuel de la Cour des comptes',
    description: 'Josiane Calculette a passé la nuit à surligner les 600 pages du rapport annuel. Verdict : les comptes « manquent de sérieux ».',
    personnage: 'calculette',
    choix: [
      { texte: 'Annoncer 12 milliards d\'économies sur un an', effets: { popularite: -10, economie: -4, education: -2, ordre: -2 }, budget: { poste: 'autres', montantMensuel: -1, dureeMois: 12 } },
      { texte: 'Raboter un peu tous les ministères', effets: { popularite: -4, economie: -1, education: -3, ordre: -1 }, budget: { poste: 'autres', montantMensuel: -0.3, dureeMois: 12 } },
      { texte: 'Créer une commission pour étudier le rapport', effets: { popularite: -2, economie: 0, education: 0, ordre: 1 }, budget: { poste: 'autres', montantMensuel: 0.01, dureeMois: 6 } },
    ],
  },
  {
    mois: 4,
    titre: 'Ouverture de la déclaration de revenus',
    description: 'Le site des impôts reçoit 10 millions de visites en une heure et affiche fièrement « Revenez plus tard ». Le pays entier rafraîchit la page.',
    choix: [
      { texte: 'Doubler les serveurs en urgence', effets: { popularite: 4, economie: 2, education: 0, ordre: 1 }, budget: { poste: 'autres', montantMensuel: 0.02, dureeMois: 1 } },
      { texte: 'Repousser la date limite d\'un mois', effets: { popularite: 6, economie: 1, education: 0, ordre: 0 }, budget: { poste: 'impots', montantMensuel: 0.5, dureeMois: 1 } },
      { texte: 'Offrir un tirage au sort aux premiers déclarants', effets: { popularite: 5, economie: 0, education: -2, ordre: -3 }, budget: { poste: 'impots', montantMensuel: 0.01, dureeMois: 1 } },
    ],
  },
  {
    mois: 5,
    titre: 'Les ponts de mai paralysent le pays',
    description: 'Entre jours fériés et ponts, le pays travaille environ quatre jours ce mois-ci. Docteur Bulle voit une bulle de chaises longues.',
    personnage: 'bulle',
    choix: [
      { texte: 'Supprimer un jour férié pour renflouer les caisses', effets: { popularite: -12, economie: 5, education: 0, ordre: -4 }, budget: { poste: 'impots', montantMensuel: -0.25, dureeMois: 12 } },
      { texte: 'Lancer une campagne « Vacances en France »', effets: { popularite: 5, economie: 4, education: 0, ordre: 0 }, budget: { poste: 'autres', montantMensuel: 0.05, dureeMois: 2 } },
      { texte: 'Profiter du pont, vous aussi', effets: { popularite: 3, economie: -6, education: 0, ordre: -1 }, budget: null },
    ],
  },
  {
    mois: 6,
    titre: 'Fuite du sujet du bac de philo',
    description: 'Noé Mégaphone annonce au mégaphone que le sujet a fuité : « Le mégaphone rend-il plus convaincant ? ». Le doute plane.',
    personnage: 'megaphone',
    choix: [
      { texte: 'Organiser une épreuve de secours en urgence', effets: { popularite: -4, economie: 0, education: 6, ordre: 2 }, budget: { poste: 'enseignement', montantMensuel: 0.03, dureeMois: 1 } },
      { texte: 'Garder le sujet : la fuite est une leçon de philo', effets: { popularite: 4, economie: 0, education: -6, ordre: -2 }, budget: null },
      { texte: 'Remplacer l\'épreuve par un débat télévisé', effets: { popularite: 6, economie: 1, education: -4, ordre: -3 }, budget: { poste: 'enseignement', montantMensuel: 0.01, dureeMois: 1 } },
    ],
  },
  {
    mois: 7,
    titre: 'Grands départs en vacances',
    description: '900 km de bouchons cumulés. La Préfète Sirène a sifflé si fort qu\'un camping entier s\'est mis au garde-à-vous.',
    personnage: 'sirene',
    choix: [
      { texte: 'Rendre les péages gratuits ce week-end', effets: { popularite: 10, economie: 2, education: 0, ordre: -3 }, budget: { poste: 'territoires', montantMensuel: 0.1, dureeMois: 1 } },
      { texte: 'Déployer gendarmes et brumisateurs sur les aires', effets: { popularite: 4, economie: 0, education: 0, ordre: 6 }, budget: { poste: 'securites', montantMensuel: 0.02, dureeMois: 2 } },
      { texte: 'Conseiller à tout le monde de partir en septembre', effets: { popularite: -6, economie: -2, education: 0, ordre: 3 }, budget: null },
    ],
  },
  {
    mois: 8,
    titre: 'Canicule d\'été',
    description: '45 °C à l\'ombre, et il n\'y a plus d\'ombre. Mamie Sondage note que la popularité fond plus vite que les glaces.',
    personnage: 'sondage',
    choix: [
      { texte: 'Déclencher le plan canicule national', effets: { popularite: 7, economie: -2, education: 0, ordre: 4 }, budget: { poste: 'solidarite', montantMensuel: 0.15, dureeMois: 2 } },
      { texte: 'Ouvrir gratuitement piscines et musées climatisés', effets: { popularite: 8, economie: 1, education: 2, ordre: -2 }, budget: { poste: 'autres', montantMensuel: 0.05, dureeMois: 2 } },
      { texte: 'Décréter la sieste obligatoire de 13 h à 17 h', effets: { popularite: 2, economie: -8, education: 0, ordre: 3 }, budget: null },
    ],
  },
  {
    mois: 9,
    titre: 'Rentrée scolaire : des classes sans prof',
    description: 'À la rentrée, des milliers de classes attendent toujours leur professeur. Noé Mégaphone propose de faire cours lui-même, au mégaphone.',
    personnage: 'megaphone',
    choix: [
      { texte: 'Recruter 10 000 enseignants', effets: { popularite: 6, economie: 0, education: 10, ordre: 1 }, budget: { poste: 'enseignement', montantMensuel: 0.05, dureeMois: 24 } },
      { texte: 'Augmenter tous les professeurs de 10 %', effets: { popularite: 8, economie: 2, education: 12, ordre: 2 }, budget: { poste: 'enseignement', montantMensuel: 0.45, dureeMois: 24 } },
      { texte: 'Regrouper les classes à 45 élèves', effets: { popularite: -8, economie: 0, education: -10, ordre: -2 }, budget: { poste: 'enseignement', montantMensuel: -0.02, dureeMois: 12 } },
    ],
  },
  {
    mois: 10,
    titre: 'Présentation du budget de l\'an prochain',
    description: 'Josiane Calculette a imprimé le projet de budget : 2 400 pages, 14 kg. Il faut maintenant choisir une ligne directrice.',
    personnage: 'calculette',
    choix: [
      { texte: 'Budget de rigueur : 25 milliards d\'économies', effets: { popularite: -12, economie: -5, education: -4, ordre: -3 }, budget: { poste: 'autres', montantMensuel: -2.1, dureeMois: 12 } },
      { texte: 'Budget de relance : investir massivement', effets: { popularite: 8, economie: 8, education: 4, ordre: 0 }, budget: { poste: 'autres', montantMensuel: 1.5, dureeMois: 12 } },
      { texte: 'Reconduire le budget actuel à l\'identique', effets: { popularite: -2, economie: 0, education: 0, ordre: 2 }, budget: null },
    ],
  },
  {
    mois: 11,
    titre: 'Le verdict des agences de notation',
    description: 'Les agences de notation publient leur verdict sur la France. Docteur Bulle a préparé 40 graphiques pour les rassurer.',
    personnage: 'bulle',
    choix: [
      { texte: 'Promettre de réduire le déficit coûte que coûte', effets: { popularite: -6, economie: -2, education: -2, ordre: -1 }, budget: { poste: 'autres', montantMensuel: -0.8, dureeMois: 12 } },
      { texte: 'Contester poliment la note', effets: { popularite: 4, economie: -3, education: 0, ordre: 0 }, budget: { poste: 'autres', montantMensuel: 0.25, dureeMois: 12 } },
      { texte: 'Inviter les agences à un dîner gastronomique', effets: { popularite: -3, economie: 2, education: 0, ordre: 0 }, budget: { poste: 'autres', montantMensuel: 0.01, dureeMois: 1 } },
    ],
  },
  {
    mois: 12,
    titre: 'Le budget doit être voté avant le 31 décembre',
    description: 'Sans budget voté, l\'État devra tourner au ralenti. Mamie Sondage rappelle que le pays veut surtout passer les fêtes tranquille.',
    personnage: 'sondage',
    choix: [
      { texte: 'Faire des concessions pour obtenir un vote', effets: { popularite: 5, economie: 1, education: 2, ordre: 4 }, budget: { poste: 'autres', montantMensuel: 0.4, dureeMois: 12 } },
      { texte: 'Passer en force et assumer', effets: { popularite: -10, economie: 2, education: 0, ordre: -5 }, budget: null },
      { texte: 'Voter une loi spéciale qui reconduit l\'ancien budget', effets: { popularite: -2, economie: -4, education: 0, ordre: 1 }, budget: null },
    ],
  },
];
