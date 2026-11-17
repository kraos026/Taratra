import assert from "node:assert/strict";
import { join } from "node:path";
function luminance(rgb) {
  const channels = rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export async function checkWorkspaceDesign(page, context, base, evidence, checks) {
  let requests = 0;
  const count = (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) requests++;
  };
  page.on("request", count);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [theme, label] of [
      ["light", "Thème clair"],
      ["dark", "Thème sombre"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const colors = await page.locator(".platform-studio").evaluate((node) => ({
        foreground: getComputedStyle(node).color,
        background: getComputedStyle(node).backgroundColor,
      }));
      assert.ok(contrast(colors.foreground, colors.background) >= 4.5);
      const historyColors = await page
        .locator(".studio-history-slot .codex-project-row > button:first-child span")
        .first()
        .evaluate((node) => ({
          foreground: getComputedStyle(node).color,
          background: getComputedStyle(node.closest(".studio-rail")).backgroundColor,
        }));
      assert.ok(contrast(historyColors.foreground, historyColors.background) >= 4.5);
      await page.screenshot({
        path: join(evidence, `workspace-mission-${theme}.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Fichier", exact: true }).click();
      const menu = page.getByRole("menu", { name: "Fichier", exact: true });
      assert.equal(await menu.getAttribute("data-platform-theme"), theme);
      const popupColors = await menu.evaluate((node) => ({
        foreground: getComputedStyle(node.querySelector("button")).color,
        background: getComputedStyle(node).backgroundColor,
      }));
      assert.ok(contrast(popupColors.foreground, popupColors.background) >= 4.5);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Workflows", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Workflows", exact: true });
      await dialog.locator(`.react-flow.${theme}`).waitFor();
      await dialog.locator(".react-flow__node").first().waitFor();
      const layout = await dialog.locator(".workflow-map").boundingBox();
      assert.ok(layout.height >= 400);
      await page.screenshot({
        path: join(evidence, `workspace-canvas-${theme}.png`),
        fullPage: true,
      });
      await dialog.getByRole("button", { name: "Fermer Workflows", exact: true }).click();
    }
    assert.equal(requests, 0);
    await page.getByRole("button", { name: "Options des projets", exact: true }).click();
    await page.getByRole("menuitem", { name: "Nouveau projet", exact: true }).click();
    await page.setViewportSize({ width: 1280, height: 720 });
    const nextAction = await page
      .getByRole("button", { name: "Continuer", exact: true })
      .boundingBox();
    assert.ok(nextAction && nextAction.y + nextAction.height <= 720);
    const projects = await page.locator(".studio-rail-section").boundingBox();
    assert.ok(projects && projects.height >= 44);
    await page.screenshot({ path: join(evidence, "workspace-setup-720.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    for (const [theme, label] of [
      ["light", "Thème clair"],
      ["dark", "Thème sombre"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({
        path: join(evidence, `workspace-setup-mobile-${theme}.png`),
        fullPage: true,
      });
    }
    await page.getByLabel("Nom de l’entreprise IA", { exact: true }).fill("Espace de recette");
    await page
      .getByLabel("Quel résultat doit produire cette équipe ?", { exact: true })
      .fill("Préparer une procédure pour les premiers clients.");
    await page.getByRole("button", { name: "Continuer", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Nom de l’agent 2", { exact: true }).fill("Coordinateur");
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page
      .getByRole("alert")
      .getByText(/nom distinct/)
      .waitFor();
    await page.getByLabel("Nom de l’agent 2", { exact: true }).fill("Analyste");
    await page.getByRole("button", { name: "Continuer", exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer l’entreprise IA", exact: true }).waitFor();
    await page.getByRole("button", { name: "Retour", exact: true }).click();
    assert.equal(
      await page.getByLabel("Nom de l’agent 2", { exact: true }).inputValue(),
      "Analyste",
    );
    assert.equal(requests, 0);
    const memoryPage = await context.newPage();
    try {
      await memoryPage.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "optivos.workspace.theme.v2")
            throw new DOMException("Blocked", "SecurityError");
          return original.call(this, key, value);
        };
      });
      await memoryPage.goto(`${base}/?enterprise`, { waitUntil: "networkidle" });
      await memoryPage.getByRole("button", { name: "Thème clair", exact: true }).click();
      assert.equal(
        await memoryPage.locator(".platform-studio").getAttribute("data-platform-theme"),
        "light",
      );
      await memoryPage
        .getByRole("status")
        .getByText(/ne permet pas de le mémoriser/)
        .waitFor();
      await memoryPage
        .getByRole("button", { name: "Ouvrir le menu du profil", exact: true })
        .click();
      await memoryPage.getByRole("menuitem", { name: "Paramètres", exact: true }).click();
      const memorySettings = memoryPage.getByRole("dialog", { name: "Paramètres", exact: true });
      await memorySettings.getByRole("button", { name: "Apparence", exact: true }).click();
      await memorySettings.getByLabel("Thème", { exact: true }).selectOption("dark");
      await memorySettings
        .getByRole("status")
        .getByText("Le thème reste actif pour cette session ; son enregistrement a été refusé.", {
          exact: true,
        })
        .waitFor();
    } finally {
      await memoryPage.close();
    }
    checks.push(
      "new workspace design: light/dark persistence, contrast >=4.5 for main text and portal menus, same theme in xyflow, canvas priority on desktop, mobile wizard and keyboard validation/back without mutation, blocked-storage session fallback",
    );
  } finally {
    page.off("request", count);
  }
}
