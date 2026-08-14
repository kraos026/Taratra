import { describe, expect, it } from "vitest";
import {
  ActorKnowledgeFirewall,
  BoundedSyntheticInterviewService,
  DeterministicSyntheticTextProvider,
  SyntheticRealismLayer,
  createGeneralizationProfiles,
  splitGeneralizationProfiles,
  type ActorPerspective,
} from "./synthetic-realism";

const perspective: ActorPerspective = {
  actorId: "actor-operator",
  role: "OPERATOR",
  knowledgeScope: ["orders"],
  beliefs: { orders: "orders are copied" },
  bias: 0.1,
  reliability: 0.8,
  confidence: 0.7,
  informationFreshness: 0.9,
  knownFacts: ["orders are copied"],
  unknownFacts: ["secret-system-truth"],
  terminology: { order: "case" },
  communicationStyle: "DIRECT",
  language: "en",
};

describe("E5.1 synthetic realism layer", () => {
  it("firewalls actor perspective from hidden facts", () => {
    const firewall = new ActorKnowledgeFirewall();
    const bounded = firewall.buildPerspective(perspective);
    expect(bounded.unknownFacts).toContain("secret-system-truth");
    expect(firewall.validateGeneratedContent("orders are copied", bounded)).toEqual([]);
    expect(firewall.validateGeneratedContent("secret-system-truth", bounded)).toContain(
      "OUT_OF_SCOPE_ASSERTION",
    );
  });

  it("routes generated interview text through E3 and preserves synthetic provenance", async () => {
    const layer = new SyntheticRealismLayer({
      level: "REALISTIC",
      promptVersion: "e5.1",
      provider: new DeterministicSyntheticTextProvider(),
    });
    const material = await layer.renderInterview(perspective, "How is work handled?", "request-1");
    expect(material.provenance).toBe("SYNTHETIC");
    expect(material.interpretation.provider).toBe("deterministic-synthetic-text-provider");
    expect(
      material.interpretation.candidates[0]?.sourceReference.startsWith(material.sourceId),
    ).toBe(true);
    expect(material.rejected).toBe(false);
  });

  it("rejects generated factual invention", async () => {
    const layer = new SyntheticRealismLayer({
      level: "ADVERSARIAL",
      promptVersion: "e5.1",
      provider: new DeterministicSyntheticTextProvider("hallucination"),
    });
    const material = await layer.renderInterview(perspective, "What is known?", "request-2");
    expect(material.rejected).toBe(true);
    expect(material.rejectionReasons).toContain("OUT_OF_SCOPE_ASSERTION");
  });

  it("bounds adaptive follow-up interviews", async () => {
    const layer = new SyntheticRealismLayer({
      level: "LIGHT_NATURAL_LANGUAGE",
      promptVersion: "e5.1",
    });
    const service = new BoundedSyntheticInterviewService(layer, 2);
    const materials = await service.askFollowUps(["q1", "q2", "q3"], perspective, "follow-up");
    expect(materials).toHaveLength(2);
  });

  it("generates deterministic core, adversarial and holdout profiles", () => {
    const profiles = createGeneralizationProfiles(50);
    const split = splitGeneralizationProfiles(profiles);
    expect(profiles).toHaveLength(50);
    expect(split.holdout.length).toBeGreaterThan(0);
    expect(split.core.length + split.adversarial.length + split.holdout.length).toBe(50);
    expect(createGeneralizationProfiles(50)).toEqual(profiles);
  });
});
