import { telechargerContenuLocal } from "@/lib/telecharger";

// Extrait de GraphiqueDonnees.tsx (voir historique de ce fichier pour le
// contexte complet des correctifs) : export PNG générique à partir d'un
// <svg> contenu dans un conteneur DOM. Ne dépend PAS de recharts --
// fonctionne sur n'importe quel SVG (recharts, dessin maison, etc.), d'où
// l'extraction : GraphiqueDonnees.tsx (```chart, recharts) ET
// SchemaGeometrique.tsx (```schema, SVG maison) réutilisent tous les deux
// cette fonction, mais seul GraphiqueDonnees.tsx a besoin de recharts. En
// gardant cette fonction hors de GraphiqueDonnees.tsx, SchemaGeometrique.tsx
// n'entraîne plus recharts dans son propre bundle en l'important.

// Export PNG ajouté le 27/07 (demande de Bourama, cas d'usage maths :
// avoir un fichier image du graphique, pas seulement le voir dans le
// chat) : 100% côté navigateur, aucune dépendance ajoutée. Le SVG rendu
// est cloné, sérialisé, dessiné sur un <canvas> (fond dj-surface pour
// rester lisible hors du thème sombre de l'app), puis exporté en PNG.
// CORRECTIF 2026-07-31 (audit UX, signalé par Bourama en test réel) : la
// légende (noms des séries/parts, ex. "Banane"/"Poire"/"Pomme") disparaît
// du PNG téléchargé alors qu'elle est bien visible dans le chat. Cause :
// recharts rend sa <Legend> comme une liste HTML (<ul>), PAS comme du
// SVG -- elle vit en dehors du <svg> cloné juste au-dessus, donc jamais
// capturée par ce clonage. On dessine maintenant la légende nous-mêmes
// sur le canvas, à partir des libellés/couleurs qu'on connaît déjà côté
// composant -- indépendant de ce que recharts affiche en HTML.
function dessinerLegende(
  ctx: CanvasRenderingContext2D,
  legende: { libelle: string; couleur: string }[],
  largeurDisponible: number,
  yDepart: number
) {
  const taillePolice = 12;
  const tailleSwatch = 10;
  const espaceSwatchTexte = 5;
  const espaceEntreItems = 16;
  const hauteurLigne = 20;
  ctx.font = `${taillePolice}px "Work Sans", sans-serif`; // 17/08 : ancien "Inter"
  ctx.textBaseline = "middle";

  // Regroupe les items en lignes qui tiennent dans largeurDisponible
  // (retour à la ligne simple, façon flex-wrap).
  const lignes: { libelle: string; couleur: string; largeur: number }[][] = [[]];
  let largeurLigneCourante = 0;
  for (const item of legende) {
    const largeurItem = tailleSwatch + espaceSwatchTexte + ctx.measureText(item.libelle).width + espaceEntreItems;
    if (largeurLigneCourante + largeurItem > largeurDisponible && lignes[lignes.length - 1].length > 0) {
      lignes.push([]);
      largeurLigneCourante = 0;
    }
    lignes[lignes.length - 1].push({ ...item, largeur: largeurItem });
    largeurLigneCourante += largeurItem;
  }

  lignes.forEach((ligne, indexLigne) => {
    const largeurTotale = ligne.reduce((total, item) => total + item.largeur, 0) - espaceEntreItems;
    let x = (largeurDisponible - largeurTotale) / 2;
    const y = yDepart + indexLigne * hauteurLigne + hauteurLigne / 2;
    for (const item of ligne) {
      ctx.fillStyle = item.couleur;
      ctx.fillRect(x, y - tailleSwatch / 2, tailleSwatch, tailleSwatch);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--dj-texte-muet").trim();
      ctx.fillText(item.libelle, x + tailleSwatch + espaceSwatchTexte, y);
      x += tailleSwatch + espaceSwatchTexte + ctx.measureText(item.libelle).width + espaceEntreItems;
    }
  });

  return lignes.length * hauteurLigne;
}

export function telechargerImage(
  conteneur: HTMLDivElement | null,
  nomFichier: string,
  onSucces: () => void,
  legende?: { libelle: string; couleur: string }[]
) {
  // Deuxième bug corrigé le 27/07 (toujours repéré par Bourama : PNG de
  // 28x28 cette fois) -- exclure seulement les icônes lucide (".lucide")
  // ne suffisait pas : recharts donne la MÊME classe "recharts-surface"
  // aux petites icônes de légende (14x14, une par série) qu'au graphique
  // principal, donc un filtre par classe reste fragile. Solution plus
  // robuste : on prend TOUS les <svg> du conteneur, on écarte les icônes
  // lucide, puis on choisit le plus GRAND par surface -- le vrai
  // graphique est toujours largement plus grand que n'importe quelle
  // icône (légende, bouton, tooltip), quelle que soit la lib utilisée.
  //
  // CORRECTIF 2026-07-31 : les appelants (GraphiqueDonnees.tsx,
  // SchemaGeometrique.tsx) scopent désormais `conteneur` au wrapper du
  // graphique/schéma SEUL, plus à toute la carte (titre + bouton
  // Télécharger avec ses propres icônes) -- le tie-break par taille
  // ci-dessous reste en place en filet de sécurité (légende vs graphique
  // dans le cas d'un camembert/bar/line), mais n'a plus à départager
  // contre des éléments de la carte qui n'ont rien à voir avec le
  // graphique lui-même.
  const candidats = Array.from(conteneur?.querySelectorAll("svg") ?? []).filter(
    (el) => !el.classList.contains("lucide")
  );
  const svgEl = candidats.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return rb.width * rb.height - ra.width * ra.height;
  })[0];
  if (!svgEl) return;
  const { width, height } = svgEl.getBoundingClientRect();
  // CORRECTIF 2026-07-31 (audit UX) : si le graphique est masqué à l'écran
  // au moment du clic (ex. dans un bloc replié/accordéon), getBoundingClientRect()
  // renvoie 0x0 -- sans cette garde, un PNG vide (0x0, invalide) était
  // téléchargé en silence, avec "Téléchargé" affiché comme si tout
  // s'était bien passé. On abandonne proprement à la place (onSucces
  // n'est pas appelé, donc pas de faux "Téléchargé").
  if (width === 0 || height === 0) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const echelle = 2; // export en meilleure résolution que l'écran (rétina)
    // Estimation généreuse de la place nécessaire pour la légende (une
    // seule ligne dans la quasi-totalité des cas réels -- jusqu'à 2
    // lignes courtes). LIMITE ASSUMÉE : une légende avec beaucoup de
    // séries à libellés longs peut déborder au-delà de cette estimation
    // fixe (pas de calcul dynamique de la hauteur avant de fixer la
    // taille du canvas, pour rester simple) -- acceptable pour l'usage
    // réel actuel (quelques séries/parts par graphique), à revoir si
    // Bourama rencontre ce cas en pratique.
    const hauteurLegendeEstimee = legende && legende.length > 0 ? 40 : 0;
    const canvas = document.createElement("canvas");
    canvas.width = width * echelle;
    canvas.height = (height + hauteurLegendeEstimee) * echelle;
    const ctx = canvas.getContext("2d");
    URL.revokeObjectURL(url);
    if (!ctx) return;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--dj-surface").trim();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(echelle, echelle);
    ctx.drawImage(img, 0, 0, width, height);
    if (legende && legende.length > 0) {
      dessinerLegende(ctx, legende, width, height + 10);
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      // 12/09/2026, Bourama : vrai téléchargement système sur Android
      // (MediaStore.Downloads + notification) au lieu du <a download>
      // web ci-dessus, qui ne fait rien dans l'appli -- voir
      // lib/telecharger.ts. Web/iOS : comportement inchangé.
      telechargerContenuLocal(nomFichier, blob, "image/png");
      onSucces();
    }, "image/png");
  };
  img.src = url;
}
