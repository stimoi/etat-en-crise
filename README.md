# L'État en crise — version 6

Le site a **3 pages**, reliées par le menu en haut :

| Page | Adresse | Ce qu'on y fait |
|---|---|---|
| 🎮 **Jouer** | `/` | Le jeu. En fin de partie, le bouton « Publier sur le mur des mandats » envoie ton résultat sur le mur. |
| 🏆 **Le mur des mandats** | `/resultats.html` | Les mandats publiés par les joueurs. Connexion avec Discord pour publier, liker 👍, disliker 👎 et commenter. Tout est stocké sur ton serveur Discord par le bot. |
| 💬 **Discussion** | `/discussion.html` | Une conversation avec l'IA : libre, ou avec un thème (Conseil des ministres, conférence de presse, comprendre le budget, ou parler à un des 5 personnages). La réponse s'écrit en direct. Dans les thèmes 💶, **tes décisions font bouger le budget** : celui de ta partie, ou un bac à sable. |

> Le mur des mandats demande une configuration Discord (section 9). Tant qu'elle n'est pas faite, le jeu et la discussion marchent normalement et le mur affiche ce qu'il manque.

Jeu web : vous dirigez l'État français. À chaque tour, une IA invente un événement avec 3 choix qui modifient 5 jauges et les finances publiques. Tenez le plus longtemps possible.

**Ce que fait le jeu :**
- **Le temps passe** : 3 tours = 1 mois (début, mi-, fin de mois). La partie commence au mois réel d'aujourd'hui.
- **De vrais chiffres** : la dette part du dernier chiffre de l'Insee (3 595,5 Md€, 119 % du PIB) et les finances suivent les comptes de **toutes les administrations publiques** (État, Sécurité sociale, collectivités) : ≈ 1 714 Md€ de dépenses par an, ≈ 12,9 Md€ de déficit par mois. Le panneau « Finances publiques » montre où va l'argent et d'où il vient.
- **Des effets immédiats, et cachés avant le choix** : les choix n'affichent que leur texte. Après la décision, tout s'applique tout de suite (dépense ponctuelle sur la dette, réforme permanente sur le déficit) et le jeu montre ce qui a changé.
- **Une IA souple** : elle peut agir en pourcentage sur n'importe quelle grande ligne (« santé −50 % », « TVA supprimée », « armée supprimée »), à sa vraie échelle.
- **Un calendrier** : 12 rendez-vous écrits à l'avance reviennent chaque année (rentrée en septembre, budget en octobre, bac en juin, canicule en août…).
- **Effets visibles**, **idée libre**, **personnages récurrents**, **événements en chaîne** (🔗), **verdict de l'Histoire** en fin de partie.
- **Difficulté croissante** : la charge de la dette grossit avec la dette, et le « niveau de crise » gonfle le coût des nouvelles mesures (jusqu'à ×2).

**Fin de partie** si la popularité, l'économie ou l'ordre public tombe à 0, ou si la dette atteint **3 700 milliards €** (≈ 122,5 % du PIB). Sans aucune économie, le seul déficit réel y mène en 8 mois de jeu.

---

## 0. Le plus simple : double-cliquer

Deux fichiers à la racine du projet lancent tout, sans taper de commande :

| Fichier | IA utilisée | Ce qu'il fait |
|---|---|---|
| **`lancer-local.bat`** | Ollama **sur ce PC** (`gemma4:31b-cloud` par défaut) | Démarre Ollama s'il ne tourne pas (`ollama serve`), télécharge le modèle s'il manque (`ollama pull`), vérifie qu'il répond, lance le jeu et ouvre le navigateur. |
| **`lancer-craftpick.bat`** | **CraftPick** (API distante, réglages `CRAFTPICK_…` du `.env`) | Vérifie que l'API répond, lance le jeu et ouvre le navigateur. |
| **`configurer-discord.bat`** | — | Vérifie la configuration Discord du mur des mandats et donne le lien pour inviter le bot (voir section 9). |
| **`mettre-en-ligne.bat`** | **CraftPick** | Met le jeu **en ligne, sans ton PC** : relais Cloudflare + site pour GitHub Pages (voir section 12). |

Les deux fichiers s'occupent aussi du reste : ils trouvent Node (même s'il n'est pas dans le PATH), installent les dépendances la première fois et créent le `.env` s'il manque. **Pour arrêter le jeu : ferme la fenêtre noire.**

Si l'IA ne répond pas, le jeu démarre quand même avec les événements écrits à la main, et la fenêtre explique pourquoi.

**Avec Ollama en local :**
- il faut avoir installé [Ollama](https://ollama.com/download) ;
- un modèle « -cloud » comme `gemma4:31b-cloud` tourne sur les serveurs d'Ollama et demande un compte : une fois, tape `ollama signin` dans un terminal ;
- pour essayer un autre modèle : change `OLLAMA_LOCAL_MODELE` dans `.env`, ou lance `lancer-local.bat llama3.2` depuis un terminal.

Les mêmes lanceurs existent en commande : `npm run local` et `npm run craftpick` (sans ouverture automatique du navigateur).

---

## 1. Installation (une seule fois)

### a) Rendre `node` et `npm` utilisables dans le terminal

Node est installé dans `C:\npm\node-v24.18.0-win-x64`, mais Windows ne le connaît pas encore.

**Solution rapide (à refaire à chaque nouveau terminal)** : dans PowerShell, tape :

```powershell
$env:Path = "C:\npm\node-v24.18.0-win-x64;" + $env:Path
```

**Solution définitive (recommandée)** :
1. Menu Démarrer → tape « variables d'environnement » → *Modifier les variables d'environnement pour votre compte*.
2. Sélectionne `Path` → *Modifier* → *Nouveau* → colle `C:\npm\node-v24.18.0-win-x64` → *OK*.
3. Ferme puis rouvre ton terminal.

Vérifie avec (les deux commandes doivent afficher un numéro de version) :

```powershell
node -v
npm -v
```

### b) Se placer dans le dossier du projet

```powershell
cd "C:\Users\ANTOINE.ROSSIGNOL\OneDrive - Conseil Régional des Pays de La Loire - Direction des Lycées\Bureau\autres\vidéo-ia-fr"
```

### c) Installer les dépendances

```powershell
npm install
```

Cette commande lit `package.json` et télécharge **Express** (le seul paquet utilisé) dans le dossier `node_modules`.

### d) Créer le fichier `.env`

```powershell
copy .env.example .env
```

Le modèle est déjà rempli avec le serveur Ollama et le modèle `gemma4:31b-cloud`. Pour changer d'IA ou de modèle, modifie simplement `.env` puis relance le serveur.
**Si l'IA est injoignable, le jeu marche quand même** avec les événements de secours.

> ⚠️ Ne publie pas le fichier `.env` : il est déjà exclu de Git via `.gitignore`.

---

## 2. Lancer le jeu

```powershell
npm start
```

Le terminal affiche `✅ Jeu lancé : ouvre http://localhost:3000`. Ouvre cette adresse dans ton navigateur.

- **Arrêter le serveur** : clique dans le terminal puis `Ctrl + C`.
- **Après une modification** d'un fichier dans `public/` : recharge simplement la page (F5).
- **Après une modification** de `server.js`, `ia/` ou `data/` : arrête le serveur (`Ctrl + C`) puis relance `npm start`. Ou utilise `npm run dev` (voir plus bas) : le serveur redémarre tout seul.

Le terminal affiche une ligne à chaque fois que l'IA n'a pas pu servir et qu'un événement de secours a été utilisé, avec la raison. C'est là qu'il faut regarder en cas de souci.

---

## 3. Les commandes prêtes à l'emploi

| Commande | À quoi ça sert |
|---|---|
| `npm start` | Lance le jeu (avec l'IA du `.env`). |
| `npm run local` | Lance le jeu avec **Ollama sur ce PC** (démarre Ollama et télécharge le modèle si besoin). Même chose que `lancer-local.bat`. |
| `npm run discord` | Vérifie la configuration Discord (réglages, bot, salons) et affiche le lien d'invitation du bot. Même chose que `configurer-discord.bat`. |
| `npm run craftpick` | Lance le jeu avec **l'IA CraftPick** après avoir vérifié que l'API répond. Même chose que `lancer-craftpick.bat`. |
| `npm run dev` | Lance le jeu **et le redémarre tout seul** à chaque modification d'un fichier du serveur. Idéal pendant que tu codes. |
| `npm test` | Lance les 51 tests automatiques : règles, budget, calendrier, validation, compatibilité avec les anciens formats, et le mur des mandats de bout en bout (serveur Node ET relais Cloudflare, testés avec un faux serveur Discord). |
| `npm run verifier` | Contrôle les données écrites à la main : totaux du budget, événements, personnages, fichier `.env`. Affiche aussi quand arrive la faillite si on ne fait rien. |
| `npm run en-ligne` | Met le jeu en ligne : envoie le relais chez Cloudflare puis fabrique `docs/index.html` pour GitHub Pages. Même chose que `mettre-en-ligne.bat` (section 12). |
| `npm run pages` | Refabrique seulement `docs/index.html` (après une modification de `public/`). |
| `npm run tester-ia` | Envoie **une** vraie demande à l'IA et affiche la réponse et le temps mis. Pratique pour vérifier la connexion ou comparer deux modèles. |

Les tests et la vérification utilisent les outils intégrés à Node : rien de plus à installer.

---

## 4. Qui fait quoi ?

```
server.js                       Serveur : assemble les routes et envoie les pages
routes/jeu.js                   Routes du jeu (événement, choix libre, bilan)
routes/connexion.js             Connexion avec Discord (OAuth2) et session
routes/mur.js                   Routes du mur des mandats (publier, voter, commenter)
routes/discussion.js            Route de la discussion avec l'IA (réponse en direct)
routes/outils.js                Adaptateur Express commun (connecté ? même site ?)
api/                            LE CŒUR des routes, sans Express : partagé par le serveur Node et le relais
relais/worker.js                Le relais Cloudflare (version GitHub Pages), branché sur api/
wrangler.jsonc                  Réglages du relais Cloudflare (aucun secret dedans)
discord/config.js               Réglages Discord lus dans .env
discord/api.js                  Appels à l'API Discord (avec gestion des limites de vitesse)
discord/oauth.js                « Se connecter avec Discord »
discord/session.js              Cookie de session signé (sans base de données)
discord/mur.js                  Le mur : Discord comme base de données + copie en mémoire
discord/presence.js             Le bot apparaît « en ligne » sur ton serveur
ia/prompts/discussion.js        Les thèmes de la page Discussion
ia/craftpickClient.js           SEUL fichier qui appelle l'IA (Ollama)
ia/prompts/commun.js            Morceaux de prompt partagés (règles, repères budgétaires, jauges, journal)
ia/prompts/evenement.js         Prompt de l'événement du tour (+ thème tiré au sort)
ia/prompts/choix-libre.js       Prompt d'évaluation d'une idée du joueur
ia/prompts/bilan.js             Prompt du verdict de fin de partie
ia/validation.js                Vérifie et nettoie les réponses de l'IA (et calcule les coûts)
ia/nettoyage.js                 Vérifie les données envoyées par le navigateur
ia/secours.js                   Événements de secours et du calendrier
data/evenements-secours.js      12 événements écrits à la main (si l'IA ne répond pas)
data/evenements-scenarises.js   12 rendez-vous du calendrier (un par mois)
data/personnages.js             Les 5 personnages récurrents
public/donnees-budget.js        LES VRAIS CHIFFRES (dette, dépenses et recettes publiques, sources)
public/regles.js                Règles partagées navigateur + serveur (temps, budget, difficulté)
public/index.html               Structure de la page
public/style.css                Apparence
public/affichage.js             Tout ce qui écrit dans la page
public/game.js                  Boucle de jeu (tours, décisions, fin de partie)
public/resultats.html + .js     Page « Le mur des mandats »
public/discussion.html + .js    Page « Discussion »
public/serveur.js               Comment les pages parlent au serveur (ou au relais, sur GitHub Pages)
public/partie.js                Sauvegarde de la partie et du bac à sable (partagée jeu ↔ discussion)
ia/prompts/decision-discussion.js  L'« arbitre » qui repère et chiffre une décision prise en discussion
lancer-local.bat                Double-clic : jeu + IA Ollama locale
lancer-craftpick.bat            Double-clic : jeu + IA CraftPick
scripts/lancer-local.js         « npm run local » (appelé par lancer-local.bat)
scripts/lancer-craftpick.js     « npm run craftpick » (appelé par lancer-craftpick.bat)
scripts/outils-lancement.js     Outils communs aux deux lanceurs
scripts/discord.js              « npm run discord » (assistant de configuration Discord)
configurer-discord.bat          Double-clic : assistant de configuration Discord
mettre-en-ligne.bat             Double-clic : mise en ligne (relais Cloudflare + GitHub Pages)
scripts/en-ligne.js             « npm run en-ligne » (appelé par mettre-en-ligne.bat)
scripts/pages.js                « npm run pages » : fabrique docs/index.html
scripts/compiler.js             « npm run compiler » : le fichier unique
docs/                           Le site publié par GitHub Pages (fabriqué, ne pas modifier à la main)
scripts/verifier.js             « npm run verifier »
scripts/tester-ia.js            « npm run tester-ia »
tests/                          « npm test » (dont faux-discord.js : un faux Discord pour les tests)
.env.example                    Modèle du fichier .env
```

**Le chemin d'un tour :**
1. `game.js` calcule la date du tour, tire au sort si ce tour sera la conséquence d'une décision passée, puis envoie au serveur les jauges, les mesures en cours et le journal des 8 dernières décisions.
2. `server.js` nettoie ces données (`nettoyage.js`). Si c'est le début d'un mois avec un rendez-vous du calendrier, il le renvoie directement. Sinon, il construit le prompt (`prompts/evenement.js`) et appelle l'IA (`craftpickClient.js`).
3. La réponse passe par `validation.js`. En cas d'échec (IA en panne, délai > 15 s, JSON invalide), `secours.js` fournit un événement écrit à la main.
4. `game.js` reçoit l'événement et le fait afficher par `affichage.js`.
5. Le joueur clique une proposition **ou** écrit son idée (envoyée à `/api/choix-libre`, évaluée par l'IA).
6. `regles.js` applique **tout de suite** les effets et le budget de la décision, fait tourner les finances d'un tiers de mois (le déficit s'ajoute à la dette) et vérifie la fin de partie. Si c'est perdu, `/api/bilan` fait écrire le verdict.

**La « mémoire » de l'IA** : une IA ne retient rien d'un appel à l'autre. C'est le jeu qui garde le journal des décisions et le renvoie à chaque tour : c'est ce qui permet aux personnages de « se souvenir ».

**Pour refaire le design** : modifie `index.html` et `style.css` librement, en gardant les `id`, les classes `jauge-…` et les attributs `data-…`. Seul `affichage.js` lit la page ; `game.js` et `regles.js` n'y touchent jamais.

**Pour régler la difficulté** : tout est dans `public/regles.js` (seuil de faillite, bornes des effets et des mesures, hausse du niveau de crise, fréquence des événements en chaîne).

---

## 5. Les finances publiques : comment ça marche

**Pourquoi toutes les administrations, et pas seulement l'État ?** Parce que la dette affichée est celle de toutes les administrations (chiffre de l'Insee), et parce que beaucoup de grandes décisions ne relèvent pas de l'État : l'assurance maladie et les retraites dépendent de la Sécurité sociale.

**Les vrais chiffres** sont tous dans `public/donnees-budget.js`, avec leurs sources :

| Donnée | Valeur (Md€ par an) | Source |
|---|---|---|
| Dette publique | 3 595,5 (119,0 % du PIB) | [Insee, fin juin 2026](https://www.insee.fr/fr/statistiques/9053525) |
| Dépenses, recettes, déficit 2025 | 1 714,2 · 1 561,7 · 152,5 | [Insee, compte des administrations publiques 2025](https://www.insee.fr/fr/statistiques/8997691) |
| Dépenses par fonction 2024 | Protection sociale 693 (dont retraites 407) · Santé 261 · Affaires économiques 166 · Enseignement 149 · Défense 54 · Ordre et sécurité 52 · Culture 43 · Logement 42 · Environnement 30 | [Insee Première n° 2093](https://www.insee.fr/fr/statistiques/8735252), retraites : [COR](https://www.cor-retraites.fr/sites/default/files/2025-06/Synth%C3%A8se_Def_.pdf) |
| Recettes par impôt | Cotisations sociales 462,3 · TVA 210,7 · CSG 153,8 · Impôt sur le revenu 88,7 · Impôt sur les sociétés 57,4 | IGF, Commission des comptes de la Sécurité sociale, Sénat |

Deux lignes sont **calculées** pour retomber exactement sur les totaux 2025 de l'Insee : « Hausse 2025 non ventilée » (les dépenses 2025 ne sont pas encore publiées par fonction) et « Autres impôts et recettes ». `npm run verifier` contrôle que tout tombe juste.

**Le calcul, à chaque tour (un tiers de mois) :**
- chaque ligne = son montant réel + les modifications du joueur (jamais en dessous de 0) ;
- les recettes suivent la jauge **Économie** (± 10 %) ;
- les **intérêts** suivent la dette (≈ 1,9 % par an) ;
- la dette augmente d'un tiers du déficit du mois.

**Trois sortes de décisions budgétaires**, toutes appliquées immédiatement :
- **ponctuelle** : une somme payée ou encaissée d'un coup, qui tombe tout de suite sur la dette ;
- **permanente** : une ligne change pour toujours (ex. santé −50 %) ; le déficit change dès ce tour ;
- **temporaire** : pareil, mais pendant N mois seulement.

**Comment l'IA chiffre** : elle choisit une ligne et donne soit un **pourcentage** de cette ligne, soit des **quantités** (2,2 millions de lycéens × 450 €), soit un montant. Le sens est toujours celui de la ligne (« la TVA baisse » = négatif), ce qui évite les erreurs de signe. C'est le **code** qui fait les multiplications : les IA se trompent souvent sur les grands nombres.

**Simplifications du jeu** (assumées) : les dépenses par fonction datent de 2024 (dernière année publiée) ; les intérêts suivent simplement la dette ; une réforme ne change pas les autres lignes (supprimer l'assurance maladie ne fait pas monter les dépenses privées). Les chiffres de départ sont réels, la suite est un jeu.

---

## 6. L'IA (serveur Ollama)

Tout l'appel à l'IA est dans `ia/craftpickClient.js`. Il utilise la route `POST /api/chat` d'Ollama ([doc](https://docs.ollama.com/api/chat)) avec `stream: false` (réponse en une fois), un délai maximum de 15 secondes (une réponse prend 2 à 6 secondes) et une longueur de réponse plafonnée (`num_predict`).

Un schéma JSON est aussi envoyé (`format`), mais **le modèle `gemma4:31b-cloud` l'ignore** (testé). La vraie protection, c'est que chaque prompt décrit le format exact attendu, et que `validation.js` vérifie tout.

**Si l'IA ne répond pas :**
- événement du tour → événement de secours, le jeu continue ;
- idée libre → message d'erreur, l'événement reste jouable avec les 3 propositions ;
- verdict de fin → un verdict de secours est affiché.

**Idée libre et sécurité** : le texte du joueur est traité comme une décision de jeu, jamais comme une instruction pour l'IA. Les tentatives de triche (« toutes les jauges à 100 ») coûtent cher, les effets restent de toute façon bornés par `validation.js`, et une proposition haineuse ou visant une personne réelle est refusée.

Les réglages sont dans `.env` : `CRAFTPICK_API_URL` (adresse du serveur), `CRAFTPICK_MODELE` (nom du modèle) et `CRAFTPICK_API_KEY` (facultatif, seulement si le serveur exige une clé).

**Événements du calendrier** : ils sont écrits à l'avance dans `data/evenements-scenarises.js`. Au début du mois concerné, le serveur les renvoie directement, sans appeler l'IA (réponse immédiate).

---

## 7. Rétrocompatibilité

Les anciennes versions continuent de fonctionner avec le nouveau code :
- **Format v1** : un événement avec une clé `"dette"` dans `"effets"` (coût immédiat en Md€) reste accepté.
- **Format v2 et v3** : un budget `{ poste, montantMensuel, dureeMois }` ou `{ quantite, coutUnitaireParMois, dureeMois }` est converti en mesure temporaire (ou ponctuelle si elle dure 1 mois).
- **Anciens noms de postes** (version « budget de l'État ») : `solidarite`, `impots`, `securites`… sont traduits vers les nouvelles lignes. Les événements écrits à la main n'ont donc pas eu besoin d'être réécrits.
- **Anciennes requêtes** : une requête sans calendrier ni mesures, ou avec `"derniersTitres"` à la place de `"journal"`, reçoit quand même un événement valide.

Tout ça est vérifié par `npm test`.

## 8. Optimisations

- Les événements écrits à la main sont **validés une seule fois**, au démarrage du serveur.
- Les parties fixes des prompts (règles, repères budgétaires) sont **calculées une seule fois**. Le message de chaque tour reste court : 8 dernières décisions, 8 plus grosses mesures.
- Les rendez-vous du calendrier **n'appellent pas l'IA**.
- La réponse de l'IA est **plafonnée en longueur**, ce qui évite un modèle trop bavard.
- Côté navigateur, `affichage.js` cherche chaque élément de la page **une seule fois**. Les listes de dépenses et de recettes sont construites une fois, puis seuls les montants et les barres sont mis à jour. Les modules sont **préchargés** (`modulepreload`).

---

## 9. Le mur des mandats et Discord

### Comment les données sont stockées

Il n'y a pas de base de données : **ton serveur Discord en sert**, et tout y reste lisible par des humains.

| Donnée | Où, sur Discord |
|---|---|
| Une publication | Un message du bot dans le salon des résultats, sous forme de « carte » (titre, résumé, tours, dette…) |
| Les commentaires | Un fil sous la publication, un message par commentaire |
| Les likes / dislikes | Une petite ligne JSON par vote dans un salon privé. Le dernier vote d'un joueur compte |

Au démarrage, le site relit tout une fois puis garde une copie en mémoire : l'affichage est instantané. Chaque action est d'abord écrite sur Discord, puis ajoutée en mémoire.

**Sécurité**
- Le site ne croit que les messages écrits par **son bot** : un faux vote tapé à la main dans le salon est ignoré (c'est testé).
- La connexion Discord ne demande que le pseudo et l'avatar (scope `identify`), jamais l'e-mail.
- La session est un cookie signé avec `SESSION_SECRET` : impossible de se faire passer pour un autre joueur.
- Les mentions comme `@everyone` écrites par les joueurs ne notifient personne.
- Il y a un anti-spam : 30 s entre deux publications, 5 s entre deux commentaires.

### Configuration pas à pas (une seule fois, environ 10 minutes)

Ces étapes se font avec **ton** compte Discord : personne d'autre ne peut les faire à ta place.

1. **Créer l'application.** Va sur [discord.com/developers/applications](https://discord.com/developers/applications), puis « New Application », et donne-lui un nom (ex. « L'État en crise »).
2. **Connexion des joueurs.** Dans l'onglet **OAuth2** :
   - copie le **Client ID** dans `DISCORD_CLIENT_ID` ;
   - clique sur « Reset Secret » et copie le **Client Secret** dans `DISCORD_CLIENT_SECRET` ;
   - dans **Redirects**, ajoute exactement `http://localhost:3000/auth/discord/callback`.
3. **Le bot.** Dans l'onglet **Bot**, clique sur « Reset Token » et copie le jeton dans `DISCORD_BOT_TOKEN`. Aucune option « Privileged Gateway Intents » n'est nécessaire.
4. **Les salons.** Sur ton serveur Discord, crée deux salons **textuels** :
   - **#mur-des-mandats** : les publications (tu peux le laisser en lecture seule pour les membres) ;
   - **#votes** : **privé**, car il contient les votes bruts.
5. **Les identifiants des salons.**
   - Active le mode développeur : Paramètres utilisateur > Avancés > Mode développeur.
   - Fais un clic droit sur chaque salon, puis « Copier l'identifiant ».
   - Colle-les dans `DISCORD_SALON_RESULTATS` et `DISCORD_SALON_VOTES`.
6. **Inviter le bot.** Double-clique sur **`configurer-discord.bat`** : il affiche le lien d'invitation avec les bonnes permissions. Ouvre-le, choisis ton serveur et valide. Pour le salon privé **#votes**, ajoute le bot (ou son rôle) dans les permissions du salon.
7. **Ajout automatique au serveur (facultatif).** Pour qu'un joueur qui se connecte rejoigne automatiquement ton serveur Discord :
   - fais un clic droit sur l'icône du serveur, puis « Copier l'identifiant du serveur », et colle-le dans `DISCORD_SERVEUR_ID` ;
   - le bot doit avoir la permission « Créer une invitation » (elle est incluse dans le lien d'invitation de `configurer-discord.bat`).

   Discord affiche « Rejoindre des serveurs pour toi » sur sa page de connexion, et la page du mur prévient aussi le joueur avant qu'il clique. Un nouveau membre voit un message de bienvenue. Pour désactiver l'ajout : `DISCORD_AJOUT_AUTO=0`.
8. **Vérifier.** Relance `configurer-discord.bat` : tout doit être ✅. Lance ensuite le jeu. Le bot apparaît « en ligne » et le mur des mandats est actif.

`SESSION_SECRET` est déjà rempli dans ton `.env` : c'est une longue suite au hasard qui signe les sessions. S'il manque, `configurer-discord.bat` en crée un.

> **Jouer à plusieurs** : en local, l'adresse `localhost` ne marche que sur ton PC. Pour que d'autres joueurs jouent et publient depuis chez eux, mets le jeu en ligne (section 12).

## 10. La page Discussion

### Les discussions qui font bouger le budget

Dans les thèmes marqués 💶 (tous sauf « Discussion libre »), quand tu **tranches** dans la conversation, ta décision s'applique au budget **tout de suite**. Exemples : « je décide de recruter 5 000 infirmiers », « adopté », « je prends la proposition du ministre du Budget ».

- **Quel budget ?** C'est toi qui choisis, en haut à gauche de la page :
  - **🎮 Ma partie** : la partie en cours du jeu. Tu la retrouves modifiée en revenant sur « Jouer », même si le jeu est ouvert dans un autre onglet.
  - **🧪 Bac à sable** : un budget d'essai qui part des vrais chiffres, pour expérimenter sans toucher à ta partie. Un bouton permet de le réinitialiser.
- **Le temps n'avance pas** pendant une discussion : une décision n'est pas un tour de jeu.
- **Comment c'est repéré ?** En même temps que la réponse en direct, une seconde demande à l'IA joue l'arbitre (`ia/prompts/decision-discussion.js`). Elle répond « pas de décision » pour une question, une hypothèse (« et si on… ? ») ou une salutation. Sinon, elle chiffre la décision avec le même format que le jeu. Testé sur 7 cas : 7 bien classés.
- **Une carte « Décision appliquée »** s'affiche dans la conversation : l'effet sur le budget, le chiffrage, le déficit avant et après, les jauges. Le bouton **Annuler** remet tout comme avant, tant que rien d'autre n'a changé depuis.
- La décision entre dans le **journal** de la partie : l'IA du jeu s'en souviendra.
- Les personnages connaissent l'état du pays (jauges, déficit) et réagissent à tes décisions.

**La partie est sauvegardée dans le navigateur** : elle survit au rechargement de la page, avec le même événement en cours. Le bouton « ↺ Nouvelle partie », en haut du jeu, en recommence une.

### Le reste

- Les thèmes sont dans `ia/prompts/discussion.js` : pour en ajouter un, ajoute un objet à la liste `THEMES`.
- Un lien direct ouvre un thème précis, par exemple `/discussion.html?theme=calculette` pour parler à Josiane Calculette.
- La réponse de l'IA arrive **morceau par morceau** (« streaming ») : le premier mot s'affiche en moins d'une seconde avec l'IA locale.
- Rien n'est enregistré : la conversation ne vit que dans la page. Les règles de contenu du jeu s'appliquent aussi ici : pas de vraies personnalités politiques, rien de partisan.

## 11. Le fichier unique (version CraftPick)

Tout le site, c'est-à-dire les 3 pages, le style et tous les modules JavaScript, est aussi disponible **dans un seul fichier HTML** : `dist/etat-en-crise.html`.

- **Il est réservé à l'IA CraftPick.** Il est servi quand le site tourne avec CraftPick : `lancer-craftpick.bat` l'ouvre directement, et il est aussi disponible avec `npm start`. Avec `lancer-local.bat`, il est volontairement refusé, et le site normal reste disponible.
- **Adresse :** `http://localhost:3000/etat-en-crise.html`. Les pages sont des « vues » du même fichier : `?vue=jouer`, `?vue=mur`, `?vue=discussion`.
- **Toutes les fonctions sont conservées** : l'IA, la sauvegarde de la partie, les discussions qui font bouger le budget, le mur des mandats, la connexion Discord (le retour se fait dans le fichier unique) et l'ajout au serveur.
- **Il faut quand même le serveur.** Il garde les secrets (jeton du bot, accès à l'IA) : le fichier ne fonctionne pas ouvert d'un double-clic.
- **Toujours à jour.** Il est recompilé à chaque démarrage du serveur à partir de `public/`, et tes fichiers sources ne sont jamais modifiés. Pour le recompiler à la main : `npm run compiler`.
- **Comment il est fabriqué** (`scripts/compiler.js`) : les modules JavaScript sont embarqués une seule fois, avec une « carte des imports » (import map) qui leur permet de se retrouver comme de vrais fichiers. Un petit script de démarrage affiche la page demandée. La compilation s'arrête avec un message clair si quelque chose ne peut pas être converti, plutôt que de produire un fichier cassé.

## 12. Mettre le jeu en ligne (GitHub Pages, sans ton PC)

Le but : une adresse du genre `https://pseudo.github.io/etat-en-crise/` que n'importe qui peut ouvrir, **même quand ton PC est éteint**, avec **tout** qui marche : l'IA, la discussion en direct, le mur des mandats, la connexion Discord et l'ajout au serveur.

### Pourquoi il faut deux morceaux

GitHub Pages ne sait **que** montrer des fichiers. Il ne peut pas :
- garder un secret (le jeton du bot, le secret Discord) : tout ce qui est publié est lisible par tout le monde ;
- appeler l'IA CraftPick : elle est en `http`, et une page `https` n'a pas le droit d'appeler une adresse `http`.

D'où deux morceaux, **tous les deux gratuits** :

| Morceau | Hébergé chez | Contenu |
|---|---|---|
| **Le site** | GitHub Pages | `docs/index.html` : tout le site dans un seul fichier, **sans aucun secret**. |
| **Le relais** | Cloudflare Workers (offre gratuite : 100 000 requêtes par jour) | `relais/worker.js` : il fait exactement le travail du serveur Node, avec **le même code** (dossier `api/`). Il garde les secrets, chiffrés chez Cloudflare. |

```
Navigateur du joueur ──► GitHub Pages (le site)
        │
        └────────────► Relais Cloudflare ──► IA CraftPick
                         (secrets ici)    └──► Discord (bot, connexion)
```

### Pas à pas (la première fois, environ 15 minutes)

1. **Compte GitHub** : crée-le sur https://github.com si tu n'en as pas. Crée un dépôt **public** nommé par exemple `etat-en-crise` (vide, sans README).
2. **Compte Cloudflare** : crée un compte gratuit sur https://dash.cloudflare.com/sign-up. Pas besoin de carte bancaire ni de nom de domaine.
3. **Double-clique `mettre-en-ligne.bat`.** Il :
   - te demande l'adresse de ton futur site (`https://TON-PSEUDO.github.io/etat-en-crise/`) ;
   - ouvre une page Cloudflare la première fois : connecte-toi et clique **Allow** ;
   - envoie le relais, puis ses réglages chiffrés ;
   - fabrique `docs/index.html` et affiche l'adresse du relais (`https://etat-en-crise-relais.….workers.dev`).
4. **Discord** : dans le [Developer Portal](https://discord.com/developers/applications) → ton application → **OAuth2** → **Redirects**, ajoute l'adresse affichée par le script (elle finit par `/auth/discord/callback`). Garde aussi celle de `localhost` : le jeu sur ton PC continuera de marcher.
5. **Envoie le projet sur GitHub.** Le plus simple : [GitHub Desktop](https://desktop.github.com) → *Add an existing repository* → choisis ce dossier → *Publish repository*. En ligne de commande :
   ```bash
   git init
   git add .
   git commit -m "L'État en crise"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/etat-en-crise.git
   git push -u origin main
   ```
   Le fichier `.env` n'est **jamais** envoyé : il est dans `.gitignore`. Vérifie-le quand même dans GitHub Desktop avant de publier.
6. **Active Pages** : sur GitHub, ton dépôt → **Settings** → **Pages** → *Source* : **Deploy from a branch** → branche **main**, dossier **/docs** → **Save**. Une à deux minutes plus tard, le site est en ligne.

### Ensuite

- **Tu modifies le jeu** (`public/`, prompts, règles…) : relance `mettre-en-ligne.bat` (il met à jour le relais ET le site), puis envoie sur GitHub (*Commit* puis *Push* dans GitHub Desktop).
- **Le relais répond-il ?** Ouvre son adresse dans le navigateur : il affiche « Relais … : en ligne » et l'adresse du site qu'il accepte.
- **Le jeu sur ton PC** (`lancer-*.bat`) marche exactement comme avant : rien ne change pour lui.

### Bon à savoir

- **Sécurité** : le relais ne répond qu'à ton site (`ORIGINE_SITE`). Les secrets ne sont ni dans le site, ni sur GitHub, ni dans `wrangler.jsonc`. Après la connexion, la session du joueur revient de Discord dans la partie `#` de l'adresse (jamais envoyée aux serveurs), est rangée dans le navigateur puis effacée de l'adresse. Une session n'est acceptée que si la connexion a été lancée depuis le même onglet.
- **Le bot apparaît « hors ligne »** sur Discord avec le relais : rester « en ligne » demande une connexion permanente, impossible sur Cloudflare. Il marche quand même : il publie, compte les votes et ajoute les joueurs.
- **Le mur est relu sur Discord toutes les 15 secondes** au plus (`DUREE_CACHE_MUR` dans `wrangler.jsonc`) : plusieurs copies du relais tournent en même temps chez Cloudflare, et chacune revoit vite ce que les autres ont écrit.
- **Adresse de l'IA** : Cloudflare refuse d'appeler une adresse IP brute comme `82.26.80.20`. Le script la transforme en `82-26-80-20.sslip.io`, un service gratuit qui renvoie vers la même machine. Si un jour l'IA a un vrai nom de domaine, mets-le dans `CRAFTPICK_API_URL` et relance la mise en ligne.
- **Tester le relais sur ton PC** (`npx wrangler dev`) : sur certains PC Windows, le moteur de Cloudflare plante au démarrage (« access violation ») s'il manque le [Visual C++ Redistributable](https://learn.microsoft.com/fr-fr/cpp/windows/latest-supported-vc-redist). Ce n'est pas nécessaire : `npm test` teste déjà le relais, et la mise en ligne n'en a pas besoin.
