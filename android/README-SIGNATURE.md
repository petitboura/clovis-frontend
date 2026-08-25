# Signature de l'APK (flavor `externe`) — à faire une seule fois

Porté depuis `clovis-mobile/android/README-SIGNATURE.md` (25/08/2026) : ce
projet Capacitor (`clovis-frontend/android/`) est **la même app**
(`com.clovis.app`) que celle de `clovis-mobile`, donc si une clé a déjà été
générée là-bas, **réutilise le même fichier `.jks`** plutôt que d'en créer un
nouveau — deux clés différentes empêcheraient toute mise à jour de
s'installer par-dessus l'app existante.

**Ce point (réutiliser la clé existante vs en générer une nouvelle) n'a pas
encore été confirmé explicitement par Bourama** : à trancher avant de
générer un premier APK `externe` signé depuis ce conteneur.

Le flavor `play` sera signé automatiquement par Google (App Signing) au
moment de la publication sur le Play Store, rien à faire ici pour lui. Ce
document concerne uniquement `externe`, distribué hors Play Store, qui doit
donc être signé "à la main", **toujours avec la même clé** pour que les
mises à jour s'installent par-dessus l'app existante sans désinstallation.

## 1. Générer la clé (une seule fois, à garder précieusement — sauter si déjà fait côté clovis-mobile)

Sur ta machine (nécessite le JDK, fourni avec Android Studio) :

```
keytool -genkeypair -v -keystore clovis-mobile-release.jks \
  -alias clovis-mobile -keyalg RSA -keysize 2048 -validity 10000
```

Choisis un mot de passe solide, et **note-le dans un gestionnaire de mots de
passe** : si tu perds ce fichier ou ce mot de passe, tu ne pourras plus
jamais mettre à jour l'app existante chez les étudiants qui l'ont déjà
installée, il faudra leur faire tout désinstaller/réinstaller.

## 2. Ne JAMAIS committer ce fichier

`clovis-mobile-release.jks` ne doit **jamais** se retrouver dans un dépôt Git
(public). Garde-le en dehors des dossiers `clovis-mobile/` et
`clovis-frontend/`, par exemple dans un dossier séparé sur ta machine, ou
dans un gestionnaire de secrets.

## 3. Configurer `keystore.properties`

Copie `android/keystore.properties.example` vers `android/keystore.properties`
(déjà dans `.gitignore`, ne sera jamais poussé), et remplis les vraies
valeurs (chemin vers le `.jks`, mots de passe, alias) — les mêmes valeurs que
côté `clovis-mobile` si tu réutilises la même clé.

## 4. À chaque nouvelle version `externe`

Avant de générer un nouvel APK à publier sur GitHub Releases :
1. Incrémenter `versionCode` **et** `versionName` dans
   `android/app/build.gradle` (`defaultConfig`).
2. Générer l'APK signé (Android Studio → Build → Generate Signed APK, flavor
   `externe`).
3. Créer une nouvelle Release GitHub sur `petitboura/clovis-mobile` (dépôt de
   référence pour `VerificateurMiseAJour.kt`, inchangé), avec un tag
   correspondant à `versionName` (ex. `v0.2.0`), et joindre l'APK en pièce
   jointe de la release.

L'app vérifie elle-même s'il existe une release plus récente que celle
installée (voir `VerificateurMiseAJour.kt`) — pas la peine d'en informer
les étudiants manuellement.
