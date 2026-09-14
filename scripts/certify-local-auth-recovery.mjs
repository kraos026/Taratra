import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import {
  ensureLocalSupabase,
  certificationEnv,
  assertLocalCertificationEnv,
  runChecked,
  startProductionApp,
  stopProcessTree,
} from "./local-certification-support.mjs";
import { configureSystemChromeForPlaywright } from "./system-chrome.mjs";

// Local-only synthetic identity; passwords, tokens and mail contents stay in memory.
const env = certificationEnv(await ensureLocalSupabase());
assertLocalCertificationEnv(env);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `cert-local-recovery-${randomUUID()}@example.invalid`;
const oldPassword = randomBytes(32).toString("base64url");
const newPassword = randomBytes(32).toString("base64url");
let userId,
  browser,
  app,
  stage = "setup";
try {
  if (!process.argv.includes("--reuse-build")) runChecked("npm", ["run", "build"], env);
  app = await startProductionApp(env);
  const created = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  assert.equal(created.error, null);
  userId = created.data.user.id;
  const chrome = configureSystemChromeForPlaywright(env);
  browser = await chromium.launch({ executablePath: chrome.executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const base = "http://localhost:3000";
  stage = "anonymous-reset-guard";
  await page.goto(`${base}/reset-password`);
  await page.waitForURL("**/forgot-password?error=recovery");
  assert.match(await page.getByRole("status").innerText(), /invalide ou expiré/);
  stage = "duplicate-signup-neutrality";
  await page.goto(`${base}/signup`);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(oldPassword);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("status").filter({ hasText: "Si cette adresse" }).waitFor();
  stage = "request-recovery";
  await page.goto(`${base}/login`);
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Demander un lien" }).click();
  await page.getByRole("status").filter({ hasText: "Si un compte correspond" }).waitFor();
  let message;
  for (let attempt = 0; attempt < 20 && !message; attempt++) {
    const inbox = await (await fetch("http://127.0.0.1:55024/api/v1/messages")).json();
    message = inbox.messages?.find((m) => m.To?.some((to) => to.Address === email));
    if (!message) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(message, "local recovery mail missing");
  stage = "mail-link-and-callback";
  const mail = await (await fetch(`http://127.0.0.1:55024/api/v1/message/${message.ID}`)).json();
  const link = mail.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  assert.ok(link);
  assert.equal(new URL(link).hostname, "127.0.0.1");
  await page.goto(link);
  await page.waitForURL("**/reset-password");
  stage = "replace-password";
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirmer le mot de passe").fill(newPassword);
  await page.getByRole("button", { name: "Modifier le mot de passe" }).click();
  await page.getByRole("status").filter({ hasText: "Mot de passe modifié" }).waitFor();
  stage = "credentials-verification";
  const auth = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  assert.ok((await auth.auth.signInWithPassword({ email, password: oldPassword })).error);
  assert.equal((await auth.auth.signInWithPassword({ email, password: newPassword })).error, null);
  await auth.auth.signOut();
  console.log(
    "LOCAL AUTH RECOVERY: PASS — anonymous guard, duplicate signup neutrality, real email, PKCE callback, password update, old-password rejection, new-password login; mobile viewport 390px",
  );
} catch (error) {
  console.error(
    `SAFE ERROR KIND: ${error?.name === "TimeoutError" ? "TIMEOUT" : String(error?.message).includes("ERR_CONNECTION_REFUSED") ? "CONNECTION_REFUSED" : "ASSERTION_OR_RUNTIME"}`,
  );
  console.error(
    `LOCAL AUTH RECOVERY: FAIL at ${stage} (details suppressed to protect recovery tokens)`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  stopProcessTree(app);
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    console.log(`LOCAL SYNTHETIC IDENTITY CLEANUP: ${error ? "FAIL" : "PASS"}`);
    if (error) process.exitCode = 1;
  }
}
