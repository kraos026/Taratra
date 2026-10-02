import { X509Certificate } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { databasePoolConfig, SUPABASE_ROOT_CA } from "./supabase-tls";

describe("Supabase database TLS trust", () => {
  it("bundles the official public CA with its verified fingerprint", () => {
    const certificate = new X509Certificate(SUPABASE_ROOT_CA);
    expect(certificate.ca).toBe(true);
    expect(certificate.fingerprint256.replaceAll(":", "")).toBe(
      "807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA",
    );
    expect(Date.parse(certificate.validTo)).toBeGreaterThan(Date.now());
  });

  it.each([
    "db.test-project.supabase.co:5432",
    "aws-0-eu-west-1.pooler.supabase.com:5432",
    "aws-0-eu-west-1.pooler.supabase.com:6543",
  ])("verifies the certificate and hostname for %s", (host) => {
    const config = databasePoolConfig(`postgresql://user:password@${host}/postgres`);
    const client = new Client(config);
    expect(client.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
    expect(client.ssl).not.toHaveProperty("checkServerIdentity");
  });

  it.each(["disable", "no-verify", "require", "verify-ca", "verify-full"])(
    "does not let URL SSL settings override strict TLS (%s)",
    (mode) => {
      const config = databasePoolConfig(
        `postgres://user:password@db.test.supabase.co/postgres?sslmode=${mode}&ssl=0&sslrootcert=missing&sslcert=missing&sslkey=missing&uselibpqcompat=true&application_name=optivos`,
      );
      const client = new Client(config);
      expect(client.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
      expect(new URL(config.connectionString!).searchParams.get("application_name")).toBe(
        "optivos",
      );
    },
  );

  it.each([
    "localhost:5432",
    "127.0.0.1:54322",
    "other.example:5432",
    "db.test.supabase.co.evil.example:5432",
  ])("preserves existing non-Supabase configuration (%s)", (host) => {
    const connectionString = `postgresql://user:password@${host}/postgres`;
    expect(databasePoolConfig(connectionString)).toEqual({ connectionString });
  });

  it("rejects hostname query overrides without exposing credentials", () => {
    expect(() =>
      databasePoolConfig("postgresql://private:secret@db.test.supabase.co/postgres?host=localhost"),
    ).toThrow("Supabase DATABASE_URL must not override its hostname");
  });

  it.each(["private-password-invalid-url", "https://private:secret@db.test.supabase.co"])(
    "rejects invalid PostgreSQL URLs with a safe message",
    (url) => {
      expect(() => databasePoolConfig(url)).toThrow("DATABASE_URL must be a valid PostgreSQL URL");
    },
  );
});
