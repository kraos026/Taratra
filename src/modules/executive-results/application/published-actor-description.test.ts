import { describe, expect, it } from "vitest";
import { publishedActorDescription, publishedActorReferences } from "./published-actor-description";

const actor = "00000000-0000-4000-8000-000000000601";
describe("published actor explanation", () => {
  it.each(["performs 100% of manual steps", "carries 75% of manual duration"])(
    "bounds %s to the published model",
    (statement) => {
      const description = `${actor} ${statement}. Add coverage and delegation.`;
      expect(publishedActorReferences(description)).toEqual([actor]);
      const result = publishedActorDescription(
        description,
        new Map([[actor, "Responsable comptable"]]),
      );
      expect(result).toContain("« Responsable comptable »");
      expect(result).toContain("connaissances publiées utilisées pour décrire le processus");
      expect(result).toContain("ne mesure pas sa charge de travail réelle");
      expect(result).not.toContain(actor);
      expect(result).toContain("Add coverage and delegation.");
    },
  );
  it.each([undefined, "", "   "])("keeps missing labels unknown: %s", (label) => {
    const result = publishedActorDescription(
      `${actor} performs 100% of manual steps.`,
      new Map(label === undefined ? [] : [[actor, label]]),
    );
    expect(result).toContain("libellé est inconnu");
    expect(result).toContain("restent à vérifier");
    expect(result).not.toContain(actor);
  });
  it("does not rewrite free source text or resolve unrelated references", () => {
    const text = `Source ${actor}. Finance performs 50% of manual steps.`;
    expect(publishedActorReferences(text)).toEqual([]);
    expect(publishedActorDescription(text, new Map([[actor, "Invented"]]))).toBe(text);
  });
});
