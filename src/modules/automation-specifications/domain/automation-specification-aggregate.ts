import type { SpecificationStatus, SpecificationValidation } from "./automation-specification";

export class AutomationSpecificationInvariantError extends Error {
  constructor(readonly kind: "conflict" | "validation") {
    super(
      kind === "conflict"
        ? "The automation specification was modified concurrently"
        : "The automation specification lifecycle invariant is not satisfied",
    );
  }
}

export interface AutomationSpecificationState {
  id: string;
  status: SpecificationStatus;
  lockVersion: number;
  versionNumber: number;
  isLatestVersion: boolean;
  validations: SpecificationValidation[];
}

export class AutomationSpecificationAggregate {
  private constructor(private readonly state: AutomationSpecificationState) {}

  static rehydrate(state: AutomationSpecificationState) {
    return new AutomationSpecificationAggregate(state);
  }

  prepareRebuild(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    if (!this.state.isLatestVersion) throw new AutomationSpecificationInvariantError("validation");
    return { previousVersionId: this.state.id, versionNumber: this.state.versionNumber + 1 };
  }

  validate(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    if (
      this.state.status !== "draft" ||
      !this.state.isLatestVersion ||
      this.state.validations.length === 0 ||
      this.hasBlockingFailures()
    )
      throw new AutomationSpecificationInvariantError("validation");
    return { from: "draft" as const, to: "validated" as const };
  }

  publish(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    if (
      this.state.status !== "validated" ||
      !this.state.isLatestVersion ||
      this.hasBlockingFailures() ||
      this.state.validations.length === 0
    )
      throw new AutomationSpecificationInvariantError("validation");
    return { from: "validated" as const, to: "published" as const };
  }

  archive(expectedLockVersion: number) {
    this.assertLock(expectedLockVersion);
    if (this.state.status === "archived" || !this.state.isLatestVersion)
      throw new AutomationSpecificationInvariantError("validation");
    return { from: this.state.status, to: "archived" as const };
  }

  private assertLock(expectedLockVersion: number) {
    if (expectedLockVersion !== this.state.lockVersion)
      throw new AutomationSpecificationInvariantError("conflict");
  }

  private hasBlockingFailures() {
    return this.state.validations.some(
      (validation) => validation.severity === "error" && !validation.passed,
    );
  }
}
