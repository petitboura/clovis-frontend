// Écran d'ouverture (25/08, demande Bourama : avant il n'y avait rien du
// tout au tout premier instant -- il fallait "quelque chose de dingue qui
// éblouit l'user"). La plume se dessine comme si elle était en train
// d'écrire, dans l'esprit "à main levée" déjà en place sur tout le reste
// de l'identité Clovis (brief section 4b : jamais un tracé qui apparaît
// d'un coup, jamais deux barbes identiques).
//
// Volontairement un composant SERVEUR (pas de "use client" ici) : il doit
// faire partie du tout premier HTML envoyé par le serveur pour être
// visible dès le premier paint, avant même que React ne s'hydrate --
// c'est le point central de la demande. Voir SplashPret.tsx + le script
// juste après ce composant dans app/layout.tsx pour la disparition.
//
// pathLength={1} sur chaque tracé animé : évite d'avoir à calculer la
// longueur réelle en pixels de chaque chemin (getTotalLength(), qui
// demande du JS côté client) pour piloter stroke-dasharray/
// stroke-dashoffset -- avec pathLength=1 ces deux valeurs vont toujours
// de 0 à 1 quelle que soit la géométrie réelle du tracé. Les tracés
// (courbes, positions) sont copiés tels quels de public/clovis-logo.svg /
// components/Logo.tsx -- même plume, juste redécoupée en étapes animées.
export function SplashOuverture() {
  return (
    <div
      id="clovis-splash"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-dj-fond"
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="splash-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--dj-logo-1)" }} />
            <stop offset="55%" style={{ stopColor: "var(--dj-logo-2)" }} />
            <stop offset="100%" style={{ stopColor: "var(--dj-logo-3)" }} />
          </linearGradient>
        </defs>

        {/* Remplissage de la vanne : invisible au départ, apparaît en
            fondu une fois le contour presque tracé -- l'encre qui se
            pose dans la forme déjà dessinée. */}
        <path
          d="M45.5 7.5 C53.5 12.5, 56.5 24, 50.5 34.5 C45.5 43.5, 35 49.5, 23.5 53.5 C24.7 46, 29.5 39, 33.5 30.5 C38 21, 42 14, 45.5 7.5 Z"
          fill="url(#splash-grad)"
          className="opacity-0 animate-[cv-remplir_.5s_ease-out_.9s_forwards]"
        />

        {/* Contour de la vanne : premier geste, le plus grand tracé. */}
        <path
          pathLength={1}
          d="M45.5 7.5 C53.5 12.5, 56.5 24, 50.5 34.5 C45.5 43.5, 35 49.5, 23.5 53.5 C24.7 46, 29.5 39, 33.5 30.5 C38 21, 42 14, 45.5 7.5 Z"
          fill="none"
          stroke="url(#splash-grad)"
          strokeWidth="1.6"
          strokeDasharray={1}
          strokeDashoffset={1}
          className="animate-[cv-trait_.8s_cubic-bezier(.34,.04,.32,1)_forwards]"
        />

        {/* Barbes : tracées une par une pendant la fin du contour,
            durées/délais volontairement inégaux (jamais deux
            identiques). */}
        <path pathLength={1} d="M41 15 L49.5 12.5" stroke="url(#splash-grad)" strokeWidth="1.6" strokeLinecap="round" opacity=".85" strokeDasharray={1} strokeDashoffset={1} className="animate-[cv-trait_.22s_ease-out_.3s_forwards]" />
        <path pathLength={1} d="M37.7 21.5 L48 18" stroke="url(#splash-grad)" strokeWidth="1.6" strokeLinecap="round" opacity=".85" strokeDasharray={1} strokeDashoffset={1} className="animate-[cv-trait_.24s_ease-out_.4s_forwards]" />
        <path pathLength={1} d="M34.2 28.7 L46.3 24.3" stroke="url(#splash-grad)" strokeWidth="1.6" strokeLinecap="round" opacity=".8" strokeDasharray={1} strokeDashoffset={1} className="animate-[cv-trait_.19s_ease-out_.49s_forwards]" />
        <path pathLength={1} d="M30.6 35.8 L43.6 30.5" stroke="url(#splash-grad)" strokeWidth="1.5" strokeLinecap="round" opacity=".75" strokeDasharray={1} strokeDashoffset={1} className="animate-[cv-trait_.26s_ease-out_.57s_forwards]" />
        <path pathLength={1} d="M26.5 42.3 L39.3 36.6" stroke="url(#splash-grad)" strokeWidth="1.4" strokeLinecap="round" opacity=".7" strokeDasharray={1} strokeDashoffset={1} className="animate-[cv-trait_.21s_ease-out_.66s_forwards]" />
        <path pathLength={1} d="M22 48.6 L33.4 43" stroke="url(#splash-grad)" strokeWidth="1.3" strokeLinecap="round" opacity=".65" strokeDasharray={1} strokeDashoffset={1} className="animate-[cv-trait_.23s_ease-out_.73s_forwards]" />

        {/* Hampe : prolonge le geste une fois la vanne tracée, comme si
            le trait continuait hors de la plume. */}
        <path
          pathLength={1}
          d="M44.5 9.5 C39 19, 31.5 33, 25 44.5 C21.8 48.5, 17.5 53, 13.5 56.5"
          fill="none"
          stroke="url(#splash-grad)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray={1}
          strokeDashoffset={1}
          className="animate-[cv-trait_.5s_ease-out_.78s_forwards]"
        />

        {/* Goutte d'encre au bout de la plume : apparaît juste après la
            hampe, comme si le trait venait de se poser. */}
        <circle
          cx="12.3" cy="57.7" r="2.4"
          fill="url(#splash-grad)"
          style={{ transformOrigin: "12.3px 57.7px" }}
          className="opacity-0 animate-[cv-goutte_.35s_ease-out_1.25s_forwards]"
        />
      </svg>
    </div>
  );
}
