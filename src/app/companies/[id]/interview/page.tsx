import { InterviewWizard } from "@/modules/interviews/presentation/interview-wizard";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <InterviewWizard companyId={(await params).id} />;
}
