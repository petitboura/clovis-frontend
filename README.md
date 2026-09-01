# clovis-frontend — Clovis

Frontend Next.js (App Router, TypeScript) de **Clovis**, IA autonome pour
établissements scolaires. Anciennement `classgpt-frontend`, renommé
pendant l'été 2026. Dépôt séparé de `djiguigne-frontend` (dont il a
hérité une partie de la structure de code initiale) et de son backend
`clovis-backend` — isolation totale, le lien avec l'écosystème Djiguignè
ne doit jamais transparaître pour l'utilisateur final.

Ce même dépôt produit aussi l'**app mobile Android/iOS** via Capacitor
(dossiers `android/` et `ios/`) : pas de code natif séparé pour l'UI, la
même app Next.js tourne dans une WebView, avec une barre d'onglets et un
menu natifs par-dessus.

**Ce README décrit l'état réel du code.** En cas de doute, le code fait
foi — pas d'anciennes conversations ou de documentation externe.

---

## Structure du dépôt

```
app/
  (app)/                 écrans connectés (voir "Écrans" plus bas)
  connexion/, inscription/  authentification
  oauth/, oauth/consent/  retour OAuth (Notion, connecteurs génériques)
  mon-espace/            section publique "Mon espace" (bibliothèque publique, portfolio)
  telecharger/           page qui sert le dernier APK publié (GitHub Releases)
  cgu/, copyright/       contenu légal
  layout.tsx             layout racine, résout NEXT_PUBLIC_APP_URL pour les balises OG

components/
  AppShell.tsx           coquille de toute l'app connectée : sidebar desktop classique (AppSidebar),
                          hamburger + tiroir coulissant sur web mobile ; en natif, la nav passe par
                          components/mobile/ à la place
  AppSidebar.tsx          sidebar desktop (Bureau/Bibliothèque/Notes en direct, groupes
                          "Personnaliser Clovis" et "Scolarité")
  mobile/
    BarreOngletsNative.tsx  vraie barre d'onglets système (plugin Capgo, pas une barre CSS/React) :
                             Bibliothèque, Contrôle de session, Chat (au milieu), Notes, Personnaliser
                             Clovis ; masquée automatiquement pendant le chat plein écran
    BarreOngletsWeb.tsx     équivalent affiché quand l'app tourne dans un navigateur mobile classique
    MenuHamburgerNatif.tsx  menu "Plus" en natif : bouton haut gauche (icône 3 barres décroissantes) +
                            panneau flottant, reprend le contenu de l'ancien onglet Plus
    MenuHamburgerWeb.tsx    même menu, variante web
    GestionRetourNatif.tsx  gestion du bouton retour matériel Android
  chat/                  composants du chat (ChatIA.tsx, ChatFlottant.tsx, BarreDeSaisie.tsx...)
  icones/, icons/        icônes du produit

lib/
  api.ts                 client HTTP vers clovis-backend (NEXT_PUBLIC_API_URL)
  supabase.ts             client Supabase (auth + DB), enregistrement des plugins Capacitor natifs
  contexteChat.tsx        état global du chat (dont l'état "plein_ecran" lu par la barre d'onglets)
  contexteCatalogue.tsx, contexteFenetres.tsx, contexteRetour.tsx  autres contextes React globaux
  canalTempsReel.ts      client du canal temps réel avec le backend (exploration de dossier mobile...)
  usePluginNatif.ts       hook d'accès générique aux plugins Capacitor
  useNotificationsPush.ts abonnement aux notifications Web Push (protégé : jamais appelé en natif,
                          la WebView Capacitor n'a pas l'objet Notification du navigateur)
  erreurs.ts              messages d'erreur centralisés, miroir de core/erreurs.py côté backend
  outils.ts, matieres.ts, coloration.ts, dateRelative.ts, formatageHeure.ts, salutations.ts  utilitaires

android/, ios/            projets Capacitor (capacitor.config.ts minimal, export statique build:capacitor
                          vers webDir "out", pas de rechargement du site distant dans la WebView)
```

## Écrans (`app/(app)`)

| Route | Contenu |
|---|---|
| `/` | Accueil (raccourcis "Mon espace", activité récente) |
| `/bureau` | Bureau |
| `/bibliotheque` | Bibliothèque personnelle (+ sous-section Dossiers du téléphone) |
| `/memoire` | Ma mémoire |
| `/comportements` | Mes skills ("comportements" en interne) |
| `/personnaliser` | Personnaliser Clovis (skills, mémoire, plugins) — onglet central du menu natif |
| `/controle-session` | Contrôle de session |
| `/rappels` | Notes / rappels |
| `/connecter-claude` | Connexion du serveur MCP public comme connecteur externe |
| `/parametres` | Paramètres (profil, préférences, confidentialité, capacités du téléphone, accessibilité, aide, à propos, zone de danger) |
| `/plus` | Menu "Plus" en version web (bureau, scolarité, connecter Claude, admin, paramètres) |
| `/admin/signalements` | Modération des signalements de contenu public |

## Navigation mobile

Décision confirmée : barre d'onglets système en bas (Bibliothèque,
Contrôle de session, Chat, Notes, Personnaliser Clovis) + menu "Plus" en
icône hamburger haut gauche plutôt qu'en onglet. Implémentée avec de
vrais composants système (`@capgo/capacitor-native-navigation` +
`@capgo/capacitor-transitions`), pas une barre stylée en CSS. La version
web mobile (navigateur, hors app installée) garde un hamburger + tiroir
coulissant équivalent mais non natif.

Six plugins Capacitor natifs existent côté Android (`MainActivity.java`) :
Dossiers, ControleSession, Connecteurs, Accessibilité, MiseAJour et
PontNatif, tous ont désormais un point d'entrée dans la nav web/TypeScript.

## Ce qui tourne en production

- App web sur Vercel (Next.js 14, React 18), consommant `clovis-backend`.
- App mobile Android/iOS buildée depuis ce même dépôt (`npm run
  build:capacitor`), distribuée hors store (APK via `/telecharger`) ;
  socle natif historique (Kotlin/Compose + Swift/SwiftUI) conservé pour
  référence dans le dépôt séparé `clovis-mobile`, plus de nouveau
  développement natif direct là bas.

## Variables d'environnement

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL de `clovis-backend` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client Supabase (auth + DB) |
| `NEXT_PUBLIC_APP_URL` | URL publique du déploiement, utilisée par `app/layout.tsx` (balises OG) et le bouton partager (lien de téléchargement de l'app) ; sur Vercel, doit être créée en type "Configuration", jamais "Secrète" (incompatible avec un préfixe `NEXT_PUBLIC_`) |

Voir `.env.local.example`.

## Lancer l'app

```
npm install
npm run dev
```

## Builder pour mobile (Capacitor)

```
npm run build:capacitor
```

Build statique Next.js vers `out/`, puis `npx cap sync`. Nécessite
Android Studio/Xcode installés localement pour ouvrir et compiler les
projets `android/`/`ios/` ensuite (hors de portée d'un sandbox sans ces
outils).
