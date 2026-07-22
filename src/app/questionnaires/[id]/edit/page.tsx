import { QuestionnaireForm } from "@/modules/questionnaires/presentation/questionnaire-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <QuestionnaireForm id={(await params).id} />;
}
