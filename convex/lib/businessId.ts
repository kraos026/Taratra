// Business identifiers, never credentials. Convex supplies deterministic mutation randomness.
export function businessId() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.floor(Math.random() * 16) >> (Number(c) / 4))).toString(16),
  );
}
