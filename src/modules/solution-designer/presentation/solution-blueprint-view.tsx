import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Blueprint = {
  name: string;
  description: string;
  architecture: string;
  status: string;
  complexityScore: unknown;
  estimatedTechnicalCostIndex: unknown;
  finalRisk: unknown;
  componentsJson: unknown;
  capabilitiesJson: unknown;
  constraintsJson: unknown;
  topologyJson: unknown;
  risksJson: unknown;
  dependenciesJson: unknown;
};
const array = (value: unknown) => (Array.isArray(value) ? value : []);
export function SolutionBlueprintView({ blueprint }: { blueprint: Blueprint }) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <Badge>{blueprint.status}</Badge>
        <h1 className="mt-2 text-3xl font-bold">{blueprint.name}</h1>
        <p className="text-muted-foreground">{blueprint.description}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Complexité" value={`${blueprint.complexityScore}/100`} />
        <Metric
          label="Indice coût technique"
          value={String(blueprint.estimatedTechnicalCostIndex)}
        />
        <Metric label="Risque maximal" value={`${blueprint.finalRisk}/100`} />
      </section>
      <Grid title="Architecture" values={[blueprint.architecture]} />
      <Grid title="Composants" values={array(blueprint.componentsJson)} />
      <Grid title="Capacités" values={array(blueprint.capabilitiesJson)} />
      <Grid title="Contraintes" values={array(blueprint.constraintsJson)} />
      <Grid title="Topologie" values={array(blueprint.topologyJson)} />
      <Grid title="Risques" values={array(blueprint.risksJson)} />
      <Grid title="Dépendances" values={array(blueprint.dependenciesJson)} />
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
function Grid({ title, values }: { title: string; values: unknown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="overflow-auto text-sm whitespace-pre-wrap">
          {JSON.stringify(values, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
