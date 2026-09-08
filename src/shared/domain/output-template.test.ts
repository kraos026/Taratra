import { describe, expect, it } from "vitest";
import { customerOutputText, hasUnresolvedTemplate } from "./output-template";

describe("catalog output boundary", () => {
  it.each(["{actor}", "Share {share}%", { nested: ["{unknown.variable}"] }])(
    "detects unresolved values",
    (value) => {
      expect(hasUnresolvedTemplate(value)).toBe(true);
    },
  );
  it("does not reject JSON, numbers or normal prose", () => {
    expect(hasUnresolvedTemplate({ value: '{"value": 1}', count: 5, text: "Fact verified" })).toBe(
      false,
    );
  });
  it("uses an explicit fallback without inventing actor or share", () => {
    expect(customerOutputText("{actor}: {share}%")).toBe(
      "[information à préciser]: [information à préciser]%",
    );
  });
});
