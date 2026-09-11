import { ConsultationDossierBibliothequePerso } from "@/components/ConsultationDossierBibliothequePerso";

// Voir generateStaticParams dans app/(app)/dossiers/[id]/page.tsx : même
// contrainte de build:capacitor (output: "export").
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function PageDossierBibliothequePerso({ params }: { params: { id: string } }) {
  return <ConsultationDossierBibliothequePerso id={params.id} />;
}
