"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AuditReport } from "../domain/audit-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const colors = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626"];
export function ReportCharts({ charts }: { charts: AuditReport["charts"] }) {
  return (
    <section aria-label="Graphiques du rapport" className="grid gap-6 lg:grid-cols-2">
      <Chart title="Scores par domaine">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={charts.domainScores}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" />
            <Radar dataKey="score" stroke="#6c4df6" fill="#6c4df6" fillOpacity={0.35} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </Chart>
      <Chart title="Temps économisé par catégorie">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={charts.hoursByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="hours" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
      <Chart title="Répartition des priorités">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={charts.priorityDistribution}
              dataKey="value"
              nameKey="name"
              innerRadius={65}
              outerRadius={105}
            >
              {charts.priorityDistribution.map((x, i) => (
                <Cell key={x.name} fill={colors[i]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Chart>
      <Chart title="ROI par recommandation">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={charts.roiByRecommendation} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={110} />
            <Tooltip />
            <Bar dataKey="roi" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
    </section>
  );
}
function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent role="img" aria-label={title}>
        {children}
      </CardContent>
    </Card>
  );
}
