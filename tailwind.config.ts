import type { Config } from "tailwindcss";

// Tokens "cgpt-*" (partie 5, traitement "à main levée") : propres à
// Clovis, n'existent pas dans djiguigne-frontend -- easings sur mesure
// (jamais de ease-in-out générique) + rayons de bordure légèrement
// irréguliers, cf. brief section 4b.
// CORRECTIF (17/08) -- Bourama a demandé de sortir de la palette
// crème/terracotta héritée de djiguigne-frontend (identifiée comme l'un
// des trois looks "cliché IA" par défaut : fond crème proche de
// #F4F1EA + accent terracotta proche de #D97757) au profit d'une
// direction propre à Clovis, "Nuit d'étude" : fond quasi noir, accent
// doré chaud, angles droits par défaut (arrondi réservé aux CTA).
// Portée : CLOVIS UNIQUEMENT -- djiguigne-frontend et djiguigne-ai
// gardent leur thème crème/terracotta d'origine, pas de décision prise
// pour eux ici.
// CORRECTIF (17/08, v2) -- Bourama a demandé les deux thèmes (clair +
// sombre), adaptatif au système par défaut + bouton pour forcer
// manuellement (voir app/globals.css pour la définition des deux jeux de
// valeurs, et components/ThemeToggle.tsx pour le bouton). Toutes les
// couleurs/dégradés dj-* référencent désormais des variables CSS
// (var(--dj-...)) plutôt que des valeurs figées, pour que les classes
// Tailwind (bg-dj-fond, text-dj-texte...) changent de couleur au runtime
// quand le thème change -- une valeur hex figée ici serait gravée dans le
// CSS généré au build et ne pourrait jamais varier. Remarque : le champ
// darkMode: "class" plus bas n'est PAS utilisé pour ce système (pas de
// classes `dark:` dans les composants) -- gardé tel quel, sans effet.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dj: {
          fond: "var(--dj-fond)",
          surface: "var(--dj-surface)",
          "surface-haute": "var(--dj-surface-haute)",
          bordure: "var(--dj-bordure)",
          "bordure-forte": "var(--dj-bordure-forte)",
          "accent-1": "var(--dj-accent-1)",
          "accent-2": "var(--dj-accent-2)",
          texte: "var(--dj-texte)",
          "texte-muet": "var(--dj-texte-muet)",
          succes: "var(--dj-succes)",
          inactif: "var(--dj-inactif)",
        },
      },
      backgroundImage: {
        "dj-gradient": "var(--dj-gradient)",
        "dj-hero-glow": "var(--dj-hero-glow)",
        // Shimmer (09/08, demande Bourama : remplacer partout le texte figé
        // "Chargement..." et les blocs animate-pulse par un balayage
        // lumineux, comme Claude.ai/Vercel). Gris neutre (dj-inactif),
        // PAS teinté accent-1 -- retour de Bourama (09/08) : l'orange
        // détonnait, la référence (capture Vercel) est grise, comme les
        // tons dj-bordure/dj-inactif déjà utilisés partout ailleurs dans
        // l'app. Deux variantes, un seul keyframe partagé (dj-shimmer,
        // voir plus bas) :
        //   - dj-shimmer : pour les blocs (rectangles de contenu à venir),
        //     opacité faible, sert de fond complet au composant Skeleton.
        //   - dj-shimmer-texte : pour un texte qui scintille sur place (ex.
        //     "{agent} réfléchit"), couleurs pleines, combiné à
        //     bg-clip-text/text-transparent côté composant.
        "dj-shimmer": "var(--dj-shimmer)",
        "dj-shimmer-texte": "var(--dj-shimmer-texte)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-work-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        // Corps des réponses de l'IA uniquement (09/08, façon Claude) --
        // voir commentaire dans app/layout.tsx. Non concerné par le
        // changement de palette/typo UI du 17/08.
        lecture: ["var(--font-lecture)", "Georgia", "serif"],
      },
      transitionTimingFunction: {
        // Apparitions (fade-in, entrée d'un message, ouverture d'un
        // panneau) : décélération franche, jamais de rebond.
        "cgpt-doux": "cubic-bezier(.25,.8,.35,1)",
        // Interactions directes (survol, clic) : très léger dépassement
        // (1.04) avant de se stabiliser -- imite l'inertie d'un geste de
        // la main.
        "cgpt-geste": "cubic-bezier(.36,0,.2,1.04)",
      },
      borderRadius: {
        // Écart de 1 à 3px entre les 4 coins -- assez subtil pour ne
        // jamais lire comme un bug de rendu, assez réel pour casser le
        // tracé vectoriel parfaitement figé (brief 4b : "les courbes ne
        // sont jamais parfaitement rondes ou parfaitement droites").
        "cgpt-bouton": "12px 13px 12px 14px",
        "cgpt-carte": "16px 17px 16px 18px",
      },
      keyframes: {
        "dj-fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "dj-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Fondu rapide (2026-07-28, demande Bourama : "rien ne doit
        // s'afficher brut") -- distinct de dj-fade-in (0.8s, pensé pour un
        // chargement de page) : utilisé pour les micro-interactions d'UI
        // (changement d'onglet, apparition d'une icône dans un slot
        // variable) où 0.8s serait perçu comme lent.
        "dj-fade-in-rapide": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "dj-orbit": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "dj-glow": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.06)" },
        },
        // Entrée d'un message dans le chat (partie 5) : jamais d'affichage
        // brut (brief 4b). Fondu + léger glissement + micro-scale.
        "cgpt-entree-message": {
          from: { opacity: "0", transform: "translateY(10px) scale(.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Apparition d'un modal (09/08, audit partie 5 : CompteRequisModal,
        // BoutonInstaller instructions iOS avaient un fond qui s'affichait
        // brut et un panneau sans easing sur mesure). Même principe que
        // cgpt-entree-message, léger scale en plus du glissement pour
        // renforcer la sensation de profondeur à l'ouverture.
        "cgpt-entree-modal": {
          from: { opacity: "0", transform: "translateY(12px) scale(.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Fermeture d'un modal (18/08/2026, demande Bourama : "ton truc
        // là s'affiche et se ferme brutement j'aime pas") -- PanneauFlottant
        // n'avait qu'une animation d'entrée, le démontage React était
        // instantané (aucune sortie possible sans garder le composant
        // monté le temps de l'anim, voir useFermetureAnimee.ts). Inverse
        // exact de cgpt-entree-modal, un peu plus rapide (fermer doit se
        // sentir réactif, pas paresseux).
        "cgpt-sortie-modal": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(8px) scale(.97)" },
        },
        // Points de l'indicateur "{agent} réfléchit" (partie 5) : rythme
        // légèrement irrégulier plutôt que animate-bounce (délais
        // parfaitement réguliers) -- brief 4b.
        "cgpt-point-reflexion": {
          "0%, 100%": { transform: "translateY(0)", opacity: ".5" },
          "35%": { transform: "translateY(-4px)", opacity: "1" },
        },
        // Balayage du shimmer : déplace la position du dégradé (voir
        // backgroundImage.dj-shimmer / dj-shimmer-texte) de droite à
        // gauche sur un fond dont la taille est doublée (bg-[length:*_100%]
        // côté composant) -- technique standard pour un shimmer en un seul
        // élément, sans pseudo-élément séparé.
        "dj-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "dj-fade-up": "dj-fade-up 0.5s ease both",
        "dj-fade-in": "dj-fade-in 0.8s ease both",
        "dj-fade-in-rapide": "dj-fade-in-rapide 0.18s ease both",
        "dj-orbit": "dj-orbit 18s linear infinite",
        "dj-glow": "dj-glow 3.2s ease-in-out infinite",
        "cgpt-entree-message": "cgpt-entree-message 0.4s cubic-bezier(.25,.8,.35,1) both",
        "cgpt-entree-modal": "cgpt-entree-modal 0.35s cubic-bezier(.25,.8,.35,1) both",
        // Durée alignée sur DUREE_FERMETURE_MS dans useFermetureAnimee.ts
        // -- si l'une change, changer l'autre (le hook attend cette durée
        // avant d'appeler le vrai démontage).
        "cgpt-sortie-modal": "cgpt-sortie-modal 0.18s cubic-bezier(.4,0,1,1) both",
        "cgpt-point-reflexion": "cgpt-point-reflexion 1.3s cubic-bezier(.25,.8,.35,1) infinite",
        // ease-in-out (pas cgpt-doux) : le shimmer représente un balayage
        // de lumière continu, pas une transition d'UI ponctuelle -- la
        // décélération franche de cgpt-doux n'a pas de sens répétée en
        // boucle.
        "dj-shimmer": "dj-shimmer 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
