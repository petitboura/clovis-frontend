"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sigma, FlaskConical } from "lucide-react";
import katex from "katex";
import "katex/contrib/mhchem/mhchem.js";
import type { MathfieldElement } from "mathlive";

// Éditeur de formule inline (2026-07-25, demande de Bourama : un deuxième
// mode de saisie où on CLIQUE des symboles au lieu de taper du LaTeX à la
// main, avec un rendu qui se construit en direct -- pas juste du texte
// brut qui ne devient une vraie formule qu'une fois le message envoyé.
//
// 2026-07-27 : n'est plus un popup flottant (retour Bourama : "plus de
// popup") -- rendu directement en ligne sous le champ de saisie
// (BarreDeSaisie.tsx), toujours visible/masqué via un seul bouton dans
// la barre d'outils plutôt qu'une bulle qui s'ouvre par-dessus tout.
//
// 2026-07-27 (suite) : "les symboles s'insèrent automatiquement, pas de
// bouton insérer/effacer" -- chaque frappe (champ MathLive, palette,
// champ chimie) notifie immédiatement le parent via `onChangeLive`, qui
// remplace en direct la portion du texte de la barre de saisie
// correspondant à cette formule -- plus de bouton "Insérer" à cliquer une
// fois la formule terminée. `onChangerOnglet` prévient le parent quand on
// bascule Maths<->Chimie, pour qu'il arrête de suivre l'ancienne portion
// (elle reste telle quelle dans le texte, mais la frappe suivante dans
// l'autre onglet doit démarrer une formule NEUVE, pas continuer à
// réécrire par-dessus la précédente).
//
// Maths : MathLive (<math-field>), web component fait pour ça --
// rendu live pendant la construction, insertion de symboles au clic via
// `.insert()`. Chimie : pas d'équivalent MathLive -- palette maison +
// aperçu KaTeX/mhchem (`\ce{...}`, extension chargée ci-dessus), syntaxe
// différente du LaTeX maths (voir explication donnée à Bourama).

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        theme?: string;
        "math-virtual-keyboard-policy"?: string;
      };
    }
  }
}

const SYMBOLES_MATHS: [string, string][] = [
  ["√", "\\sqrt{#0}"], ["x²", "#0^{2}"], ["xⁿ", "#0^{#0}"], ["a/b", "\\frac{#0}{#0}"],
  ["∫", "\\int_{#0}^{#0}"], ["Σ", "\\sum_{#0}^{#0}"], ["∞", "\\infty"], ["π", "\\pi"],
  ["∈", "\\in"], ["∉", "\\notin"], ["⊂", "\\subset"], ["∅", "\\emptyset"],
  ["≤", "\\leq"], ["≥", "\\geq"], ["≠", "\\neq"], ["≈", "\\approx"],
  ["→", "\\to"], ["±", "\\pm"], ["θ", "\\theta"], ["Δ", "\\Delta"],
];

const SYMBOLES_CHIMIE: [string, string][] = [
  ["→", "->"], ["⇌", "<=>"], ["+", " + "],
  ["indice₂", "_2"], ["indice₃", "_3"], ["charge⁺", "^+"], ["charge⁻", "^-"],
  ["(s)", "(s)"], ["(l)", "(l)"], ["(g)", "(g)"], ["(aq)", "(aq)"],
  ["Δ", "\\Delta"], ["H₂O", "H2O"], ["CO₂", "CO2"],
];

export function EditeurFormule({
  onChangeLive,
  onChangerOnglet,
  onFermer,
  valeurInitiale,
}: {
  /** Appelé à chaque frappe avec le texte final ($...$ ou $\ce{...}$),
   * ou "" si le champ est vide -- le parent remplace/insère en direct
   * dans la barre de saisie, sans étape "Insérer" séparée. */
  onChangeLive: (texteAffiche: string) => void;
  /** Prévient le parent qu'on change d'onglet (Maths<->Chimie) -- il doit
   * arrêter de suivre la portion précédente comme "en cours d'édition". */
  onChangerOnglet: () => void;
  onFermer: () => void;
  /** Pré-remplit le champ maths -- utilisé par l'OCR formule (image ->
   * LaTeX via Gemini, voir BarreDeSaisie.tsx:extraireFormuleDeImage) pour
   * une relecture/correction avant insertion, plutôt qu'une insertion
   * directe sans passage par l'éditeur (une transcription OCR peut se
   * tromper). */
  valeurInitiale?: string;
}) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [onglet, setOnglet] = useState<"maths" | "chimie">("maths");
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const [valeurChimie, setValeurChimie] = useState("");
  const inputChimieRef = useRef<HTMLInputElement>(null);
  // "mathlive" définit un custom element (<math-field>) en touchant des
  // API navigateur au chargement -- importé dynamiquement ici plutôt
  // qu'en haut du fichier pour ne jamais s'exécuter côté serveur (Next.js
  // fait quand même tourner le code des modules "use client" importés
  // statiquement au moment du rendu serveur, même si le composant lui-même
  // ne s'affiche pas encore).
  const [mathliveInstalle, setMathliveInstalle] = useState(false);
  useEffect(() => {
    import("mathlive").then(() => setMathliveInstalle(true));
  }, []);

  function notifierMaths() {
    const latex = mathfieldRef.current?.value?.trim();
    onChangeLive(latex ? `$${latex}$` : "");
  }

  function notifierChimie(valeur: string) {
    const v = valeur.trim();
    onChangeLive(v ? `$\\ce{${v}}$` : "");
  }

  // Pré-remplissage (OCR formule) : ne peut se faire qu'une fois le
  // custom element <math-field> réellement enregistré par le navigateur
  // (mathliveInstalle) -- avant ça, `.value = ...` sur un élément non
  // encore upgradé n'aurait aucun effet. `.value = ...` par API ne
  // déclenche pas d'événement input -- notification manuelle nécessaire
  // pour que le parent insère bien ce pré-remplissage tout de suite (plus
  // de bouton "Insérer" pour le faire après coup).
  useEffect(() => {
    if (!mathliveInstalle || !valeurInitiale || !mathfieldRef.current) return;
    mathfieldRef.current.value = valeurInitiale;
    notifierMaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mathliveInstalle]);

  // Correctif (2026-07-31, demande Bourama : "rien ne se passe" au clic
  // sur le bouton clavier) -- en lisant le code source de MathLive : la
  // redirection du panneau vers un <div> à nous (ci-dessous, tentative du
  // 2026-07-25) désactive silencieusement toute la logique interne de
  // dimensionnement automatique de la lib -- celle-ci ne calcule/applique
  // une hauteur RÉELLE que lorsque le clavier reste dans son emplacement
  // d'origine (`container === document.body`, vérifié explicitement dans
  // sa fonction show()). Avec un conteneur perso, cette vérification
  // échoue et rien n'est jamais dimensionné ni affiché -- ce n'est pas un
  // problème de timing ou de CSS de notre côté, c'est la lib elle-même
  // qui coupe court. On revient donc à son comportement natif (panneau
  // ancré en bas de l'écran, plein format, exactement comme un clavier
  // de téléphone) plutôt que de continuer à fiabiliser un mode que la lib
  // ne supporte pas correctement.

  // Correctif (2026-07-31, demande Bourama) : le clavier virtuel de
  // MathLive (voir plus haut) s'affiche maintenant ancré tout en bas de
  // l'écran, par-dessus le reste de la page -- sur PC surtout, où le
  // champ de formule peut être plus haut dans la page, rien ne le
  // remonte automatiquement : il peut rester caché derrière le clavier
  // qui vient de s'ouvrir par-dessus. Dès que le clavier devient visible
  // (événement "geometrychange" de MathLive), on fait remonter le champ
  // à l'écran.
  useEffect(() => {
    if (!mathliveInstalle) return;
    function auChangementGeometrie() {
      if (window.mathVirtualKeyboard?.visible) {
        mathfieldRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    window.mathVirtualKeyboard.addEventListener("geometrychange", auChangementGeometrie);
    return () => window.mathVirtualKeyboard.removeEventListener("geometrychange", auChangementGeometrie);
  }, [mathliveInstalle]);

  // Correctif (2026-07-31, demande Bourama) : jusqu'ici, seul un nouveau
  // clic sur le bouton clavier le refermait -- un clic n'importe où
  // ailleurs sur la page devait aussi le faire disparaître (comportement
  // attendu d'un vrai clavier). On ignore les clics à l'intérieur du
  // panneau du clavier lui-même (".ML__keyboard", injecté dans <body>,
  // hors de portée de `conteneurRef`) et à l'intérieur du champ de
  // formule (cliquer dans le champ pour repositionner le curseur ne doit
  // pas fermer le clavier qu'on est justement en train d'utiliser).
  //
  // Correctif (2026-07-31, demande Bourama : "sa disparition qui est
  // brute") -- vérifié dans le code source MathLive : sa fonction hide()
  // supprime le panneau du DOM instantanément, sans aucune transition
  // (contrairement à l'ouverture, qui elle est animée -- voir
  // `.animate` dans le CSS de la lib). On ne peut pas se contenter de
  // retirer sa classe "is-visible" nous-mêmes pour profiter de sa
  // transition CSS : cette transition n'existe QUE quand "is-visible" ET
  // "animate" sont présents ensemble, donc la retirer désactive la
  // transition au même instant qu'elle devrait s'appliquer. On anime
  // donc nous-mêmes le panneau (fondu + léger glissement) avec l'API
  // Web Animations avant d'appeler hide(), qui peut alors supprimer le
  // panneau déjà invisible sans que ça se voie.
  function fermerClavierEnDouceur() {
    const panneau = document.querySelector(".ML__keyboard") as HTMLElement | null;
    if (!panneau || !panneau.animate) {
      window.mathVirtualKeyboard?.hide();
      return;
    }
    const anim = panneau.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(12px)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.4, 0, 1, 1)" }
    );
    anim.finished
      .catch(() => {})
      .finally(() => window.mathVirtualKeyboard?.hide());
  }

  useEffect(() => {
    if (!mathliveInstalle) return;
    function surClicDocument(e: PointerEvent) {
      if (!window.mathVirtualKeyboard?.visible) return;
      const cible = e.target as Node;
      const panneauClavier = document.querySelector(".ML__keyboard");
      if (panneauClavier?.contains(cible)) return;
      if (mathfieldRef.current?.contains(cible)) return;
      fermerClavierEnDouceur();
    }
    document.addEventListener("pointerdown", surClicDocument);
    return () => document.removeEventListener("pointerdown", surClicDocument);
  }, [mathliveInstalle]);

  // Le panneau du clavier virtuel de MathLive est injecté au niveau de
  // <body>, pas dans le shadow DOM du <math-field> -- son thème se règle
  // donc là, pas sur le champ lui-même. Retiré au démontage pour ne pas
  // laisser un attribut global qui ne concerne que cet éditeur.
  useEffect(() => {
    const valeurPrecedente = document.body.getAttribute("theme");
    document.body.setAttribute("theme", "dark");
    return () => {
      if (valeurPrecedente === null) document.body.removeAttribute("theme");
      else document.body.setAttribute("theme", valeurPrecedente);
    };
  }, []);

  // Rendu direct de la formule chimie pendant la construction (même
  // principe que MathLive côté maths, mais fait main puisqu'il n'y a pas
  // de composant équivalent pour mhchem).
  const [previsuChimie, setPrevisuChimie] = useState("");
  useEffect(() => {
    if (!valeurChimie.trim()) {
      setPrevisuChimie("");
      return;
    }
    try {
      setPrevisuChimie(katex.renderToString(`\\ce{${valeurChimie}}`, { throwOnError: false, displayMode: true }));
    } catch {
      setPrevisuChimie("");
    }
  }, [valeurChimie]);

  function insererSymboleChimie(snippet: string) {
    const el = inputChimieRef.current;
    const debut = el?.selectionStart ?? valeurChimie.length;
    const fin = el?.selectionEnd ?? valeurChimie.length;
    const nouvelleValeur = valeurChimie.slice(0, debut) + snippet + valeurChimie.slice(fin);
    setValeurChimie(nouvelleValeur);
    notifierChimie(nouvelleValeur);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = debut + snippet.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  // Le clavier virtuel de MathLive ne se referme pas tout seul quand ce
  // panneau se ferme (X) -- fermeture explicite via l'API globale, sinon
  // il reste ouvert à l'écran sans plus aucun moyen de le fermer une fois
  // le panneau lui-même disparu.
  useEffect(() => {
    return () => {
      window.mathVirtualKeyboard?.hide();
    };
  }, []);

  function fermer() {
    window.mathVirtualKeyboard?.hide();
    onFermer();
  }

  function changerOnglet(nouvel: "maths" | "chimie") {
    if (nouvel === onglet) return;
    onChangerOnglet();
    setOnglet(nouvel);
  }

  return (
    <div ref={conteneurRef} className="mt-2 w-full rounded-2xl border border-dj-bordure bg-dj-surface-haute p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-dj-surface p-1">
          <button
            onClick={() => changerOnglet("maths")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
              onglet === "maths" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet"
            }`}
          >
            <Sigma size={14} /> Maths
          </button>
          <button
            onClick={() => changerOnglet("chimie")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
              onglet === "chimie" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet"
            }`}
          >
            <FlaskConical size={14} /> Chimie
          </button>
        </div>
        <button onClick={fermer} aria-label="Fermer" className="text-dj-texte-muet hover:text-dj-texte">
          <X size={16} />
        </button>
      </div>

      {onglet === "maths" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SYMBOLES_MATHS.map(([label, snippet]) => (
              <button
                key={label}
                onClick={() => {
                  mathfieldRef.current?.insert(snippet, { selectionMode: "placeholder" });
                  notifierMaths();
                }}
                className="rounded-md border border-dj-bordure px-2 py-1 text-sm text-dj-texte hover:bg-dj-surface"
              >
                {label}
              </button>
            ))}
          </div>
          <math-field
            ref={mathfieldRef}
            math-virtual-keyboard-policy="manual"
            theme="dark"
            onInput={notifierMaths}
            className="w-full rounded-lg border border-dj-bordure bg-dj-surface px-3 py-3 text-lg text-dj-texte"
          />
          {!mathliveInstalle && (
            <p className="mt-1 animate-dj-shimmer bg-dj-shimmer-texte bg-[length:200%_100%] bg-clip-text text-xs text-transparent">
              Chargement de l'éditeur...
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SYMBOLES_CHIMIE.map(([label, snippet]) => (
              <button
                key={label}
                onClick={() => insererSymboleChimie(snippet)}
                className="rounded-md border border-dj-bordure px-2 py-1 text-sm text-dj-texte hover:bg-dj-surface"
              >
                {label}
              </button>
            ))}
          </div>
          <input
            ref={inputChimieRef}
            value={valeurChimie}
            onChange={(e) => {
              setValeurChimie(e.target.value);
              notifierChimie(e.target.value);
            }}
            placeholder="Ex: 2H2 + O2 -> 2H2O"
            className="mb-2 w-full rounded-lg border border-dj-bordure bg-dj-surface px-3 py-2 text-sm text-dj-texte outline-none"
          />
          {previsuChimie && (
            <div
              className="overflow-x-auto rounded-lg border border-dj-bordure bg-dj-surface p-3"
              dangerouslySetInnerHTML={{ __html: previsuChimie }}
            />
          )}
        </>
      )}
    </div>
  );
}
