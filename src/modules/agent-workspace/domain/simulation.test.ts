import { describe, expect, it } from "vitest";
import { moveAgentMission, prepareAgentMission } from "./simulation";
const prepare = () =>
  prepareAgentMission(
    "mission1",
    "company1",
    "Fiche activité",
    "Présenter mon activité et mes services.",
  );
describe("Atelier IA simulation state machine", () => {
  it("requires validation and never creates a result from an unapproved mission", () => {
    const mission = prepare();
    expect(mission.state).toBe("approval");
    expect(moveAgentMission(mission, "company1", "finish")).toBe(mission);
    const running = moveAgentMission(mission, "company1", "approve");
    expect(moveAgentMission(running, "company1", "approve")).toBe(running);
    const completed = moveAgentMission(running, "company1", "finish");
    expect(completed.state).toBe("completed");
    expect(completed.result).toContain("EXEMPLE SIMULÉ");
    expect(moveAgentMission(completed, "company1", "finish")).toBe(completed);
  });
  it("keeps an interrupted simulation stopped, without a fabricated result", () => {
    const stopped = moveAgentMission(prepare(), "company1", "stop");
    expect(stopped.state).toBe("stopped");
    expect(stopped.result).toBeNull();
    expect(moveAgentMission(stopped, "company1", "approve")).toBe(stopped);
    expect(moveAgentMission(stopped, "company1", "finish")).toBe(stopped);
  });
  it("rejects another company context", () => {
    expect(() => moveAgentMission(prepare(), "company2", "approve")).toThrow("Contexte");
  });
  it("bounds user text and never treats it as a command", () => {
    expect(() => prepareAgentMission("id", "company1", "ok", "too short")).toThrow();
    expect(() => prepareAgentMission("id", "company1", "Titre", "a".repeat(4001))).toThrow();
    const mission = prepareAgentMission(
      "id",
      "company1",
      "<script>test</script>",
      "Un texte à présenter, pas une commande.",
    );
    expect(mission.title).toBe("<script>test</script>");
    expect(mission.result).toBeNull();
  });
});
