import { describe, expect, it } from "vitest";
import { CapabilityClassification } from "./automation-generator-enums";
import { GenerationInvariantViolation } from "./automation-generator-errors";
import {
  ExplanationCode,
  ExplanationParameters,
  GenerationExplanation,
  GenerationProvenance,
} from "./generation-provenance";
import { nodeId, provenanceReference } from "./automation-generator-test-fixtures";

describe("Generation provenance", () => {
  it.each([
    CapabilityClassification.Consumed,
    CapabilityClassification.Transformed,
    CapabilityClassification.Defaulted,
  ])("requires a generated element for %s", (classification) => {
    expect(() =>
      GenerationProvenance.create({
        generatedElementId: null,
        sourceSpecificationElementId: "source",
        capabilityCode: "capability",
        classification,
        reference: provenanceReference(),
      }),
    ).toThrow(GenerationInvariantViolation);
  });

  it.each([CapabilityClassification.Ignored, CapabilityClassification.Unsupported])(
    "requires an explicit reason for %s",
    (classification) => {
      expect(() =>
        GenerationProvenance.create({
          generatedElementId: null,
          sourceSpecificationElementId: "source",
          capabilityCode: "capability",
          classification,
          reference: provenanceReference(),
        }),
      ).toThrow("requires a reason code");
    },
  );

  it("creates an explainable consumed provenance record", () => {
    const explanation = GenerationExplanation.create({
      generatedElementId: nodeId(),
      code: ExplanationCode.create("CAPABILITY_PROJECTED"),
      parameters: ExplanationParameters.create({ source: "source" }),
    });
    const provenance = GenerationProvenance.create({
      generatedElementId: nodeId(),
      sourceSpecificationElementId: "source",
      capabilityCode: "capability",
      classification: CapabilityClassification.Consumed,
      reference: provenanceReference(),
      explanation,
    });
    expect(provenance.classification).toBe(CapabilityClassification.Consumed);
    expect(Object.isFrozen(provenance)).toBe(true);
  });

  it("never permits ignored provenance to target a generated element", () => {
    expect(() =>
      GenerationProvenance.create({
        generatedElementId: nodeId(),
        sourceSpecificationElementId: "source",
        capabilityCode: "capability",
        classification: CapabilityClassification.Ignored,
        reference: provenanceReference(),
        reasonCode: ExplanationCode.create("NOT_REQUIRED"),
      }),
    ).toThrow("cannot target");
  });
});
