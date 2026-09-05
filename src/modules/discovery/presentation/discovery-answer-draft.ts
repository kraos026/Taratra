export type StoredDiscoveryAnswer = { step: string; valueJson: unknown };
type Draft = Record<string, string>;
type Row = Record<string, unknown>;
const record = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.map(record) : []);

export function readDiscoveryAnswers(session: { answers: StoredDiscoveryAnswer[] }): Draft {
  const draft: Draft = {};
  for (const answer of session.answers) {
    const value = record(answer.valueJson);
    for (const [key, v] of Object.entries(value)) {
      if (key === "step") continue;
      if (Array.isArray(v))
        draft[key] = v
          .map((x) => {
            const item = record(x);
            return String(item.name ?? item.title ?? x);
          })
          .join(", ");
      else if (v !== null) draft[key] = String(v);
    }
    if (answer.step === "software")
      draft.software = rows(value.items)
        .map((item) => String(item.name ?? ""))
        .join(", ");
    if (answer.step === "processes") {
      const items = rows(value.items);
      draft.processes = items.map((item) => String(item.name ?? "")).join(", ");
      if (items[0]?.categoryCode != null) draft.processCategory = String(items[0].categoryCode);
      draft.painPoints = [
        ...new Set(
          items.flatMap((item) =>
            Array.isArray(item.painPoints) ? item.painPoints.map(String) : [],
          ),
        ),
      ].join(", ");
    }
    if (answer.step === "business") {
      for (const [key, list, property] of [
        ["offeringType", "offerings", "type"],
        ["objectivePriority", "objectives", "priority"],
        ["challengeSeverity", "challenges", "severity"],
      ]) {
        const first = rows(value[list])[0]?.[property];
        if (first != null) draft[key] = String(first);
      }
    }
  }
  return draft;
}

const arrayFields: Record<
  string,
  { text: string; identity: string; controls?: Record<string, string> }
> = {
  offerings: { text: "offerings", identity: "name", controls: { type: "offeringType" } },
  objectives: {
    text: "objectives",
    identity: "title",
    controls: { priority: "objectivePriority" },
  },
  challenges: {
    text: "challenges",
    identity: "title",
    controls: { severity: "challengeSeverity" },
  },
  departments: { text: "departments", identity: "name" },
  roles: { text: "roles", identity: "title" },
  software: { text: "software", identity: "name" },
  processes: {
    text: "processes",
    identity: "name",
    controls: { categoryCode: "processCategory", painPoints: "painPoints" },
  },
};

/** Preserve stored detail that the compact form does not edit. The API contract is unchanged. */
export function preserveDiscoveryDetails(
  previous: StoredDiscoveryAnswer | undefined,
  draft: Draft,
  candidate: Row,
): Row {
  if (!previous) return candidate;
  const original = record(previous.valueJson);
  const baseline = readDiscoveryAnswers({ answers: [previous] });
  const result = { ...original, ...candidate };
  for (const [key, value] of Object.entries(candidate)) {
    if (key === "step") continue;
    if (!Array.isArray(value)) {
      if (draft[key] === baseline[key] && key in original) result[key] = original[key];
      continue;
    }
    const rule = arrayFields[key === "items" ? previous.step : key];
    if (!rule || !Array.isArray(original[key])) continue;
    const controls = rule.controls ?? {};
    const changedControls = Object.entries(controls)
      .filter(([, field]) => draft[field] !== baseline[field])
      .map(([property]) => property);
    if (draft[rule.text] === baseline[rule.text] && !changedControls.length) {
      result[key] = original[key];
      continue;
    }
    const oldItems = rows(original[key]);
    if (draft[rule.text] === baseline[rule.text]) {
      result[key] = oldItems.map((old) => {
        const preserved = { ...old };
        for (const property of changedControls) preserved[property] = rows(value)[0]?.[property];
        return preserved;
      });
      continue;
    }
    const usedClientIds = new Set(oldItems.map((item) => item.clientId));
    result[key] = value.map((item, index) => {
      const next = record(item);
      const old = oldItems.find((entry) => entry[rule.identity] === next[rule.identity]);
      if (!old) {
        if (key === "departments" && usedClientIds.has(next.clientId)) {
          let clientId = `new-${index}`;
          while (usedClientIds.has(clientId)) clientId = `new-${clientId}`;
          usedClientIds.add(clientId);
          return { ...next, clientId };
        }
        return item;
      }
      const preserved = { ...next, ...old };
      for (const property of changedControls) preserved[property] = next[property];
      return preserved;
    });
  }
  return result;
}
