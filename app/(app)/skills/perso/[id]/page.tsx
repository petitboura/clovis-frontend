import { ConsultationSkillPerso } from "@/components/ConsultationSkillPerso";

// Voir generateStaticParams dans app/(app)/skills/[id]/page.tsx : même
// contrainte de build:capacitor (output: "export").
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function PageSkillPerso({ params }: { params: { id: string } }) {
  return <ConsultationSkillPerso id={params.id} />;
}
