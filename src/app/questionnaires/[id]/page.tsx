import { QuestionnaireDetail } from "@/modules/questionnaires/presentation/questionnaire-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <QuestionnaireDetail id={(await params).id} />;
}
