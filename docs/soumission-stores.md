# Soumission Play Store / App Store, suivi (03/09/2026)

Ce fichier centralise le statut de chaque point de la checklist envoyée
par Bourama, pour que n'importe quelle session future reprenne
exactement où celle-ci s'est arrêtée. Rien ici n'a été deviné : chaque
ligne "FAIT" vient d'un audit direct du code, chaque ligne "BLOQUÉ"
explique précisément ce qui manque et qui doit le fournir.

## Bloquant / priorité haute

- [x] **AccessibilityService exclu du build `play`**, déjà en place
  avant cette session (flavor `externe` seul a le vrai service, `play`
  a un stub qui refuse tout). Rien à changer.
- [x] **Suppression de compte dans l'app**, déjà codée
  (`EspaceParametres.tsx` -> `DELETE /api/profiles/me`,
  `api/profiles.py:supprimer_mon_compte`). À tester en prod.
- [x] **Suppression de compte hors app**, le site web `clovis-frontend`
  est accessible sans app installée, `/parametres` (même bouton) y est
  atteignable après connexion. Couvre l'exigence Play/Apple.
- [x] **Privacy Policy**, infrastructure créée cette session (route
  `/confidentialite`, backend `api/legal/confidentialite` ajouté à la
  whitelist), MAIS le contenu doit être collé par Bourama dans la table
  Supabase `contenu_legal` (même principe que `cgu`/`copyright`, lecture
  seule côté backend, écriture au dashboard). **Brouillon complet
  ci-dessous**, à relire avant de coller, voir "Ce que je n'ai pas pu
  deviner".
- [ ] **Data Safety Google Play**, brouillon ci-dessous, à saisir dans
  la Play Console (formulaire, pas du code).

## Permissions et conformité

- [x] `PACKAGE_USAGE_STATS` et `ACCESS_NOTIFICATION_POLICY` : déjà
  commentées dans le code avec leur usage réel (temps d'écran,
  contrôle de session/DND). Justifications rédigées pour le formulaire
  Play Console, voir plus bas.
- [x] Cohérence permissions déclarées : audit fait, seulement 4
  permissions au total (`INTERNET`, `POST_NOTIFICATIONS`,
  `ACCESS_NOTIFICATION_POLICY`, `PACKAGE_USAGE_STATS`), toutes
  documentées.

## Firebase / Notifications

- [x] **Bug corrigé (iOS)** : `NotificationsNatives.demanderAutorisation()`
  demandait l'autorisation locale mais ne déclenchait jamais
  `UIApplication.registerForRemoteNotifications()`. Résultat :
  `didRegisterForRemoteNotificationsWithDeviceToken` n'était jamais
  appelé, donc le token APNs n'était jamais envoyé au backend, le canal
  push iOS était mort côté client, indépendamment de toute config
  Firebase/APNs côté serveur. Corrigé + un ré-enregistrement automatique
  à chaque lancement ajouté (recommandation Apple, le token peut changer).
- [ ] **Ce qui reste, hors de portée du code** (confirmé en lisant
  `core/notifications_push.py`, commentaire TODO de Bourama déjà présent
  dans le fichier) :
  - Android (FCM) : créer un projet Firebase, activer Cloud Messaging,
    générer une clé de compte de service -> `google-services.json` à
    déposer dans `android/app/`, + `FCM_SERVICE_ACCOUNT_JSON_B64` et
    `FCM_PROJECT_ID` côté backend (Railway).
  - iOS (APNs) : compte Apple Developer Program, générer une clé APNs
    (.p8) -> `APNS_KEY_P8_B64`, `APNS_KEY_ID`, `APNS_TEAM_ID` côté
    backend.
  - **Aucune des deux ne passe par le SDK Firebase iOS** : l'architecture
    existante utilise APNs nativement pour iOS (JWT signé, API HTTP/2
    directe) et FCM HTTP v1 pour Android, pas de dépendance Firebase
    iOS à ajouter au projet Xcode. Ajouter le SDK Firebase iOS serait
    redondant avec ce qui existe déjà et introduirait un second pipeline
    inutile.
  - Ces 5 identifiants sont des secrets/fichiers que je ne peux pas
    fabriquer, accès Firebase Console + Apple Developer nécessaires,
    tous deux à toi.
- [ ] Tests FCM/APNs en conditions réelles (app ouverte/arrière-plan/
  fermée) : nécessite un vrai appareil, à faire une fois les identifiants
  ci-dessus en place.

## OAuth

- [ ] Tests des flux OAuth en prod + vérification des redirect URI
  réelles : pas d'audit fait cette session (pas bloquant côté code
  d'après le chantier connecteurs déjà en place), à tester
  manuellement.

## iOS / App Store

- [x] `PrivacyInfo.xcprivacy` : créé (`ios/App/App/PrivacyInfo.xcprivacy`)
  et ajouté au projet Xcode (référence + phase Resources). Construit à
  partir d'un audit réel du code Swift (`UserDefaults` utilisé dans
  `DossiersDesignesRepository.swift`, aucune autre Required Reason API
  trouvée, aucun SDK tracking/pub dans le dépôt). **Types de données
  collectées déclarés = première ébauche (email + contenu utilisateur),
  à faire valider par toi avant soumission**, je n'ai pas le schéma
  Supabase complet pour garantir l'exhaustivité légale.
- [x] Sign in with Apple : pas trouvé dans le dépôt (aucune mention
  `ASAuthorizationAppleIDProvider` ni bouton correspondant). Si Clovis
  propose une connexion via un autre fournisseur tiers (Google, etc.),
  Apple **exige** Sign in with Apple en option équivalente. À confirmer :
  quels moyens de connexion existent aujourd'hui (email/mot de passe
  seul, ou aussi OAuth tiers) ?
- [x] Suppression de compte côté iOS : même route que web/Android
  (`DELETE /api/profiles/me`, appelée depuis `EspaceParametres.tsx`,
  composant partagé), donc déjà couverte.
- [ ] Métadonnées App Store (screenshots, description, etc.) : non
  commencé, hors du dépôt de code.

## Décision prise le 03/09/2026 (Bourama) : audience de cette soumission

Clovis est un produit pour établissements scolaires (élèves/enseignants),
basé en Tunisie/Afrique du Nord, avec création de compte directe dès
l'arrivée sur l'app. Le collège (11-13 ans) fait partie du public visé à
terme, mais **pas de cette première soumission** : décision explicite de
ne rien bloquer dans le code d'inscription (aucun changement fait,
l'inscription reste ouverte telle quelle), et de déclarer l'audience
comme lycée/15 ans et plus dans les formulaires Play Console et App
Store Connect pour cette version. Le collège sera ajouté dans une future
mise à jour, avec la conformité adaptée à ce moment (âge à l'inscription
et/ou invitation par l'établissement, à retrancher de ce fichier quand
ce chantier sera lancé).

Conséquence pratique sur les formulaires :
- Google Play, questionnaire de classification de contenu : public visé
  = 13 ans et plus (pas "Designed for children" ni "Mixed Audience").
- Google Play, Data Safety, "Application destinée aux enfants" : Non.
- App Store Connect, tranche d'âge cible ("Age Rating" / "Made for
  Kids") : pas la catégorie Kids. Note rédactionnelle Bourama : garder
  la description store cohérente (ne pas écrire "collège" tant que ce
  n'est pas rouvert).

---

## Brouillon, Privacy Policy (à coller dans `contenu_legal`, clé `confidentialite`)

Construit uniquement à partir des fonctionnalités réellement présentes
dans le code (comptes, bibliothèque de documents, comportements/skills,
connecteurs OAuth Google Drive/Notion/GitHub, notifications, contrôle de
session/temps d'écran, mémoire). **Champs entre crochets `[...]` = je ne
peux pas les inventer, à remplir avant publication.**

```markdown
# Politique de confidentialité de Clovis

Dernière mise à jour : [date]

## Qui nous sommes

Clovis est édité par [nom légal de l'entité / auto-entrepreneur],
[adresse ou pays d'immatriculation]. Pour toute question sur cette
politique ou vos données : [email de contact].

## Données que nous collectons

- **Compte** : adresse email, mot de passe (chiffré), et les
  informations de profil que vous renseignez.
- **Contenu que vous créez** : documents ajoutés à votre bibliothèque,
  conversations avec l'assistant, comportements/skills personnalisés,
  éléments enregistrés dans votre mémoire.
- **Connecteurs externes (optionnels)** : si vous connectez un compte
  Google Drive, Notion, GitHub ou Claude, nous accédons aux données de
  ce service dans la limite des permissions que vous accordez au moment
  de la connexion, et uniquement pour exécuter les actions que vous
  demandez.
- **Notifications** : un identifiant technique (token push) est
  enregistré si vous activez les notifications, pour vous envoyer les
  rappels que vous programmez.
- **Fonctionnalités optionnelles de l'app mobile** : si vous les
  activez, l'app peut avoir accès (i) à l'état "Ne pas déranger" de
  votre téléphone pour l'activer/désactiver pendant une session que vous
  démarrez vous-même, et (ii) à vos statistiques d'usage d'applications
  pour la fonctionnalité de suivi du temps d'écran. Aucune des deux
  n'est activée sans action explicite de votre part, et vous pouvez les
  désactiver à tout moment dans les réglages de votre téléphone.

## Comment nous utilisons ces données

Uniquement pour faire fonctionner Clovis : authentification, réponses
de l'assistant, bibliothèque, comportements, rappels, connecteurs que
vous activez. Nous ne vendons pas vos données et ne les utilisons pas à
des fins publicitaires.

## Sous-traitants / hébergement

- **Supabase** : hébergement de la base de données et des fichiers.
- **[fournisseur du modèle de langage principal]** : traitement de vos
  messages pour générer les réponses de l'assistant.
- **Google (Firebase Cloud Messaging)** et **Apple (APNs)** :
  acheminement des notifications push, selon votre appareil.
- **[autres sous-traitants, ex. le routeur de comportements, hébergeur
  Railway/Vercel]** : à compléter.

## Conservation et suppression

Vous pouvez supprimer votre compte à tout moment depuis Clovis
(Paramètres) ou depuis le site web, même sans avoir l'application
installée. La suppression efface [préciser : immédiatement / sous X
jours] vos données de compte et de bibliothèque.

## Vos droits

[à adapter selon les juridictions visées, RGPD si utilisateurs UE,
etc.] Vous pouvez demander l'accès, la correction ou la suppression de
vos données en nous contactant à [email de contact].

## Mineurs

Clovis est actuellement destiné aux lycéens (15 ans et plus), aux
étudiants et aux enseignants. Nous ne visons pas sciemment les enfants
de moins de 13 ans avec la version actuelle de l'application. Si vous
pensez qu'un enfant de moins de 13 ans a créé un compte, contactez-nous
à [email de contact] pour que nous puissions le supprimer.
```

---

## Brouillon, justifications permissions (Play Console, formulaire "Permissions sensibles")

**`PACKAGE_USAGE_STATS`** : Utilisée uniquement pour la fonctionnalité
optionnelle de suivi du temps d'écran de l'utilisateur (visible dans
l'app sous [nom de l'écran concerné, ex. "Concentration"/"Temps
d'écran"]). L'utilisateur doit explicitement se rendre dans
Réglages > Accès spécial > Accès à l'usage et activer la permission,
aucune collecte silencieuse, aucune donnée d'usage envoyée à des tiers
publicitaires.

**`ACCESS_NOTIFICATION_POLICY`** : Utilisée uniquement pendant une
session de concentration démarrée volontairement par l'utilisateur,
pour activer/désactiver le mode "Ne pas déranger" le temps de la
session. Redirection vers les réglages système, pas de popup standard.

## Brouillon, Data Safety (Google Play)

- Collecte de données : Oui.
- Types : Email (identifiant), Fichiers/documents utilisateur, Contenu
  des conversations avec l'assistant, Identifiant d'appareil (token
  push).
- Partagée avec des tiers : Non (sous-traitance technique uniquement,
  hébergement, envoi des notifications, traitement IA, pas de vente
  ni de partage publicitaire).
- Chiffrement en transit : Oui (HTTPS).
- Suppression de compte possible : Oui, dans l'app et hors de l'app.
- Application destinée aux enfants : Non (audience déclarée = 13 ans et
  plus pour cette version, voir décision du 03/09/2026 plus haut).
