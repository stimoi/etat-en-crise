// =====================================================================
// evenements-secours.js — Événements écrits à la main.
//
// Utilisés quand l'IA ne répond pas ou répond mal : le jeu ne s'arrête
// jamais. Même format que ce qu'on demande à l'IA :
//  - "effets" : popularite, economie, education, ordre (de -15 à +15) ;
//  - "budget" : { poste, montantMensuel (Md€/mois, positif = coûte), dureeMois }
//    ou null si le choix ne coûte rien. Repère : l'État dépense ≈ 37,7 Md€/mois.
//  - "personnage" (facultatif) : identifiant d'un personnage de data/personnages.js.
// L'ancien format (une clé "dette" dans "effets") reste accepté.
// Tu peux en ajouter : « npm run verifier » contrôle leur format.
// =====================================================================

export const EVENEMENTS_SECOURS = [
  {
    titre: 'Canicule dans les salles de classe',
    description: 'Il fait 41 °C au lycée. Les élèves cuisent plus vite que les croque-monsieur de la cantine.',
    choix: [
      { texte: 'Installer la climatisation dans tous les lycées', effets: { popularite: 8, economie: 0, education: 10, ordre: 0 }, budget: { poste: 'enseignement', montantMensuel: 0.25, dureeMois: 12 } },
      { texte: 'Décaler les cours à 5 h du matin', effets: { popularite: -8, economie: 0, education: 4, ordre: -3 }, budget: null },
      { texte: 'Distribuer des ventilateurs à manivelle', effets: { popularite: -3, economie: 4, education: -2, ordre: 0 }, budget: { poste: 'enseignement', montantMensuel: 0.02, dureeMois: 3 } },
    ],
  },
  {
    titre: 'Les lycéens exigent la sieste',
    description: 'Noé Mégaphone réclame une sieste obligatoire de 14 h à 15 h pour tous les lycéens. Le mouvement gagne même la salle des profs.',
    personnage: 'megaphone',
    choix: [
      { texte: 'Instaurer la sieste nationale', effets: { popularite: 10, economie: -6, education: 4, ordre: 3 }, budget: { poste: 'enseignement', montantMensuel: 0.05, dureeMois: 12 } },
      { texte: 'Refuser fermement et maintenir les cours', effets: { popularite: -6, economie: 2, education: -4, ordre: -8 }, budget: null },
      { texte: 'Organiser une consultation lycéenne en ligne', effets: { popularite: 4, economie: 0, education: 6, ordre: -3 }, budget: { poste: 'enseignement', montantMensuel: 0.01, dureeMois: 2 } },
    ],
  },
  {
    titre: 'Pénurie nationale de moutarde',
    description: 'Plus un seul pot de moutarde en rayon. Les sandwichs jambon-beurre traversent une crise existentielle.',
    choix: [
      { texte: 'Importer de la moutarde en urgence', effets: { popularite: 6, economie: -3, education: 0, ordre: 3 }, budget: { poste: 'autres', montantMensuel: 0.1, dureeMois: 2 } },
      { texte: 'Lancer un grand plan « Moutarde souveraine »', effets: { popularite: 3, economie: 8, education: 0, ordre: -2 }, budget: { poste: 'autres', montantMensuel: 0.15, dureeMois: 18 } },
      { texte: 'Déclarer la mayonnaise condiment officiel', effets: { popularite: -8, economie: 3, education: 0, ordre: -4 }, budget: null },
    ],
  },
  {
    titre: 'Une agence de notation fronce les sourcils',
    description: 'Une agence de notation menace de faire passer la France de « A » à « Peut mieux faire ». Josiane Calculette en est à son troisième malaise.',
    personnage: 'calculette',
    choix: [
      { texte: 'Annoncer 24 milliards d\'économies sur un an', effets: { popularite: -12, economie: -5, education: -3, ordre: -3 }, budget: { poste: 'autres', montantMensuel: -2, dureeMois: 12 } },
      { texte: 'Vendre aux enchères les meubles des ministères', effets: { popularite: 4, economie: -2, education: 0, ordre: -3 }, budget: { poste: 'autres', montantMensuel: -0.05, dureeMois: 3 } },
      { texte: 'Envoyer une jolie carte de vœux à l\'agence', effets: { popularite: 2, economie: -4, education: 0, ordre: 0 }, budget: { poste: 'autres', montantMensuel: 0.3, dureeMois: 12 } },
    ],
  },
  {
    titre: 'Invasion de pigeons sur les ministères',
    description: 'Des milliers de pigeons ont élu domicile sur les toits des ministères. Ils semblent étrangement bien organisés.',
    choix: [
      { texte: 'Recruter des faucons fonctionnaires', effets: { popularite: 5, economie: 0, education: 0, ordre: 6 }, budget: { poste: 'securites', montantMensuel: 0.02, dureeMois: 6 } },
      { texte: 'Ouvrir des négociations avec les pigeons', effets: { popularite: 7, economie: -2, education: 2, ordre: -6 }, budget: { poste: 'autres', montantMensuel: 0.01, dureeMois: 3 } },
      { texte: 'Ignorer le problème et vendre des parapluies', effets: { popularite: -5, economie: 5, education: 0, ordre: -3 }, budget: null },
    ],
  },
  {
    titre: 'Le bac en jeu télévisé ?',
    description: 'Une chaîne propose d\'organiser le bac en prime time, avec buzzer et public. L\'audience promet d\'être historique.',
    choix: [
      { texte: 'Accepter et vendre les droits télé', effets: { popularite: 8, economie: 4, education: -12, ordre: -2 }, budget: { poste: 'impots', montantMensuel: -0.05, dureeMois: 1 } },
      { texte: 'Refuser et garder les épreuves écrites', effets: { popularite: -4, economie: -2, education: 6, ordre: 2 }, budget: null },
      { texte: 'Transformer seulement le grand oral en karaoké', effets: { popularite: 6, economie: 1, education: -5, ordre: -3 }, budget: { poste: 'enseignement', montantMensuel: 0.01, dureeMois: 1 } },
    ],
  },
  {
    titre: 'Le pays entier est hors ligne',
    description: 'Un câble sous-marin a été grignoté par un poisson très affamé. Plus aucune connexion internet depuis ce matin.',
    choix: [
      { texte: 'Réparer en urgence, coûte que coûte', effets: { popularite: 5, economie: 8, education: 0, ordre: 3 }, budget: { poste: 'autres', montantMensuel: 0.5, dureeMois: 2 } },
      { texte: 'Proclamer une « journée nationale sans écran »', effets: { popularite: -6, economie: -10, education: 8, ordre: 2 }, budget: null },
      { texte: 'Ressortir les Minitel des greniers', effets: { popularite: 4, economie: -4, education: -2, ordre: 0 }, budget: { poste: 'autres', montantMensuel: 0.1, dureeMois: 6 } },
    ],
  },
  {
    titre: 'Les trottinettes prennent la fuite',
    description: 'Des milliers de trottinettes électriques roulent seules vers la mer. La Préfète Sirène a cassé son sifflet à force de siffler.',
    personnage: 'sirene',
    choix: [
      { texte: 'Créer une brigade anti-trottinettes', effets: { popularite: 2, economie: 0, education: 0, ordre: 8 }, budget: { poste: 'securites', montantMensuel: 0.03, dureeMois: 12 } },
      { texte: 'Les laisser partir en vacances', effets: { popularite: 5, economie: -5, education: 0, ordre: -6 }, budget: null },
      { texte: 'Les recycler en chaises pour les lycées', effets: { popularite: 3, economie: 2, education: 5, ordre: -2 }, budget: { poste: 'enseignement', montantMensuel: 0.02, dureeMois: 4 } },
    ],
  },
  {
    titre: 'Pénurie de croissants',
    description: 'La farine manque : les boulangeries rationnent à un croissant par personne et par semaine. Le pays gronde.',
    choix: [
      { texte: 'Subventionner le beurre et la farine', effets: { popularite: 10, economie: 3, education: 0, ordre: 4 }, budget: { poste: 'autres', montantMensuel: 0.4, dureeMois: 6 } },
      { texte: 'Promouvoir fièrement le pain de la veille', effets: { popularite: -8, economie: 2, education: 0, ordre: -4 }, budget: null },
      { texte: 'Financer le croissant imprimé en 3D', effets: { popularite: -3, economie: 7, education: 3, ordre: 0 }, budget: { poste: 'recherche', montantMensuel: 0.1, dureeMois: 12 } },
    ],
  },
  {
    titre: 'Copies de philo écrites par des IA',
    description: 'Toutes les copies de philo du pays commencent par « En tant que modèle de langage ». Les correcteurs sont perplexes.',
    choix: [
      { texte: 'Interdire les écrans pendant les devoirs', effets: { popularite: -6, economie: -2, education: 7, ordre: 2 }, budget: { poste: 'enseignement', montantMensuel: 0.01, dureeMois: 12 } },
      { texte: 'Former profs et élèves à l\'IA', effets: { popularite: 3, economie: 5, education: 6, ordre: 0 }, budget: { poste: 'enseignement', montantMensuel: 0.15, dureeMois: 24 } },
      { texte: 'Faire corriger les copies par une IA aussi', effets: { popularite: 2, economie: 3, education: -10, ordre: -2 }, budget: { poste: 'enseignement', montantMensuel: -0.05, dureeMois: 12 } },
    ],
  },
  {
    titre: 'Pluies diluviennes',
    description: 'Des pluies records ont transformé plusieurs villages en Venise improvisée. Les canards, eux, sont ravis.',
    choix: [
      { texte: 'Débloquer un fonds d\'urgence massif', effets: { popularite: 10, economie: 3, education: 0, ordre: 5 }, budget: { poste: 'territoires', montantMensuel: 1, dureeMois: 3 } },
      { texte: 'Envoyer les secours en pédalos', effets: { popularite: 4, economie: -2, education: 0, ordre: 6 }, budget: { poste: 'securites', montantMensuel: 0.1, dureeMois: 2 } },
      { texte: 'Créer une taxe sur les bottes de pluie', effets: { popularite: -10, economie: -3, education: 0, ordre: -2 }, budget: { poste: 'impots', montantMensuel: -0.02, dureeMois: 12 } },
    ],
  },
  {
    titre: 'Ruée de touristes',
    description: 'Une vidéo virale élit la France « pays le plus mignon du monde ». Les touristes arrivent par millions.',
    choix: [
      { texte: 'Taxer les selfies devant les monuments', effets: { popularite: -4, economie: 3, education: 0, ordre: -2 }, budget: { poste: 'impots', montantMensuel: -0.1, dureeMois: 12 } },
      { texte: 'Transformer les internats en auberges cet été', effets: { popularite: 3, economie: 6, education: -4, ordre: -3 }, budget: { poste: 'impots', montantMensuel: -0.03, dureeMois: 2 } },
      { texte: 'Investir dans des trains de nuit flambant neufs', effets: { popularite: 6, economie: 8, education: 0, ordre: 0 }, budget: { poste: 'ecologie', montantMensuel: 0.2, dureeMois: 24 } },
    ],
  },
];
