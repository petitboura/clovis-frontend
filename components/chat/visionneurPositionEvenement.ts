// Séparé de VisionneurPositionGlobal.tsx à dessein (26/08) : ce fichier
// ne doit JAMAIS importer react-pdf/pdfjs-dist. VisionneurPositionGlobal
// est chargé via next/dynamic({ssr:false}) UNIQUEMENT dans ChatIA.tsx
// pour éviter que pdfjs-dist (qui touche des API navigateur dès son
// import) casse le rendu serveur -- si ce fichier-ci importait
// VisionneurPositionGlobal.tsx, tout endroit import ouvrirPosition
// (SourcesBulle.tsx, BulleMessage.tsx, tous deux rendus bien plus tôt
// dans l'arbre) réintroduirait le même risque via un import statique
// détourné. Donc : ce module ne contient QUE le type + le petit
// dispatcher d'évènement, rien d'autre.

export type DetailOuverturePosition = {
  url: string;
  titre: string;
  positionType?: "page" | "timestamp" | null;
  positionValeur?: number | null;
};

export const EVENEMENT_OUVRIR_POSITION = "clovis:ouvrir-position";

export function ouvrirPosition(detail: DetailOuverturePosition) {
  window.dispatchEvent(new CustomEvent<DetailOuverturePosition>(EVENEMENT_OUVRIR_POSITION, { detail }));
}
