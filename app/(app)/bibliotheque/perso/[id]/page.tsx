import { ConsultationFichierBibliothequePerso } from "@/components/ConsultationFichierBibliothequePerso";

// Voir generateStaticParams dans app/(app)/bibliotheque/[id]/page.tsx :
// même contrainte de build:capacitor (output: "export"), même id
// "placeholder" jamais réellement atteint (voir ConsultationFichierBibliothequePerso).
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function PageFichierBibliothequePerso({ params }: { params: { id: string } }) {
  return <ConsultationFichierBibliothequePerso id={params.id} />;
}
