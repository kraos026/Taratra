import { VersionEditor } from "@/modules/questionnaires/presentation/questionnaire-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const p = await params;
  return <VersionEditor templateId={p.id} versionId={p.versionId} />;
}
