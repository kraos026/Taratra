import { createHash } from "node:crypto";
import type {
  ClockPort,
  DeterministicIdFactory as DeterministicIdFactoryPort,
} from "../application/automation-generator-application-ports";
import { GenerationId, GenerationLineageId } from "../domain/automation-generator-value-objects";

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

export class UuidFactory implements DeterministicIdFactoryPort {
  generationId(input: Parameters<DeterministicIdFactoryPort["generationId"]>[0]): GenerationId {
    return GenerationId.create(
      deterministicUuid([
        "generation",
        input.tenantId.value,
        input.specificationSnapshotId,
        input.idempotencyKey.value,
      ]),
    );
  }

  generationLineageId(
    input: Parameters<DeterministicIdFactoryPort["generationLineageId"]>[0],
  ): GenerationLineageId {
    return GenerationLineageId.create(
      deterministicUuid(["lineage", input.tenantId.value, input.specificationLineageId]),
    );
  }
}

function deterministicUuid(parts: readonly string[]): string {
  const digest = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
