import type { BlueprintStatus, BlueprintValidation } from "./solution-designer";

export class SolutionBlueprintInvariantError extends Error {
  constructor(readonly kind: "conflict" | "validation") {
    super(
      kind === "conflict"
        ? "The blueprint was modified concurrently"
        : "The blueprint lifecycle invariant is not satisfied",
    );
  }
}

export interface SolutionBlueprintState {
  id: string;
  status: BlueprintStatus;
  lockVersion: number;
  validations: BlueprintValidation[];
  evidenceCount: number;
}

export class SolutionBlueprintAggregate {
  private constructor(private readonly state: SolutionBlueprintState) {}

  static rehydrate(state: SolutionBlueprintState) {
    return new SolutionBlueprintAggregate(state);
  }

  prepareRebuild(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    return { previousVersionId: this.state.id };
  }

  validate(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    if (this.state.status !== "draft" || this.hasBlockingFailures())
      throw new SolutionBlueprintInvariantError("validation");
    return { from: "draft" as const, to: "validated" as const };
  }

  publish(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    if (
      this.state.status !== "validated" ||
      this.hasBlockingFailures() ||
      this.state.evidenceCount === 0
    )
      throw new SolutionBlueprintInvariantError("validation");
    return { from: "validated" as const, to: "published" as const };
  }

  private assertLock(expectedLockVersion: number) {
    if (this.state.lockVersion !== expectedLockVersion)
      throw new SolutionBlueprintInvariantError("conflict");
  }

  private hasBlockingFailures() {
    return this.state.validations.some(
      (validation) => validation.severity === "error" && !validation.passed,
    );
  }
}
