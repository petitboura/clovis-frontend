# Signature de l'APK (flavor `externe`) — conteneur Capacitor

Lot 3C (Phase 3, fusion Capacitor). Meme principe que pour l'ancien socle
natif (voir `clovis-mobile/android-legacy-natif/README-SIGNATURE.md`) : le
flavor `play` sera signe automatiquement par Google (Play App Signing) au
moment de la publication sur le Play Store, rien a faire ici pour lui. Ce
document concerne uniquement `externe`, distribue hors Play Store.

## Point important : reutiliser la meme cle que l'ancien socle natif

Si une cle `clovis-mobile-release.jks` a deja ete generee pour le flavor
`externe` de `clovis-mobile/android-legacy-natif`, c'est cette meme cle qui
doit servir ici une fois ce conteneur Capacitor pret a etre distribue (Lot
3D). Une nouvelle cle romprait la chaine de mise a jour : les etudiants qui
ont deja installe la version native `externe` ne pourraient plus mettre a
jour vers la version Capacitor sans desinstaller/reinstaller.

Ce point n'a pas encore ete confirme avec Bourama a l'ecriture de ce
document (Lot 3C ne fait que poser l'isolation du build, pas la
distribution reelle) : a trancher avant de generer un premier APK `externe`
signe depuis ce conteneur.

## Configurer `keystore.properties`

Copie `android/keystore.properties.example` vers `android/keystore.properties`
(ignore explicitement par git, voir `android/.gitignore`), et remplis les
vraies valeurs (chemin vers le `.jks`, mots de passe, alias) — celles de la
cle existante si le point ci-dessus est confirme, ou celles d'une nouvelle
cle si Bourama decide explicitement d'en generer une autre.
