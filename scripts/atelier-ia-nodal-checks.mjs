import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function checkNodalCanvas(page, evidence, checks) {
  let apiRequests = 0;
  const count = (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests++;
  };
  page.on("request", count);
  const accept = (dialog) => dialog.accept();
  page.on("dialog", accept);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Workflows", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Workflows", exact: true });
    await editor.locator(".react-flow__node").first().waitFor();
    assert.equal(await editor.locator(".react-flow__node").count(), 4);
    assert.equal(await editor.getByLabel("Autonomie de la mission").inputValue(), "");
    await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
    await editor
      .getByRole("status")
      .getByText(/Structure valide/)
      .waitFor();
    async function exported(name) {
      const ready = page.waitForEvent("download");
      await editor.getByRole("button", { name: "Exporter le brouillon", exact: true }).click();
      const download = await ready;
      const destination = join(evidence, name);
      await download.saveAs(destination);
      return JSON.parse(readFileSync(destination, "utf8"));
    }
    const simple = await exported("nodal-simple.json");
    await editor.getByLabel("Vue du workflow").selectOption("advanced");
    const advanced = await exported("nodal-advanced.json");
    assert.deepEqual(advanced.workflow.nodes, simple.workflow.nodes);
    assert.deepEqual(advanced.workflow.edges, simple.workflow.edges);
    assert.deepEqual(advanced.mission, simple.mission);
    await editor
      .getByLabel("Consigne du bloc")
      .fill("Préparer une procédure claire pour accueillir les clients.");
    assert.equal(
      await editor.getByRole("status").textContent(),
      "Reliez les blocs puis vérifiez la structure.",
    );
    const edited = await exported("nodal-edited.json");
    assert.ok(edited.workflow.revision > simple.workflow.revision);
    assert.equal(edited.mission.workflow.revision, edited.workflow.revision);
    const source = edited.workflow.edges[0].from,
      target = edited.workflow.edges[0].to;
    await editor.getByRole("button", { name: "Retirer la connexion 1", exact: true }).click();
    await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
    assert.ok((await editor.locator(".workflow-errors li").count()) > 0);
    await editor
      .getByLabel("Sortie", { exact: true })
      .selectOption(`${source.nodeId}/${source.portId}`);
    await editor
      .getByLabel("Entrée", { exact: true })
      .selectOption(`${target.nodeId}/${target.portId}`);
    await editor.getByRole("button", { name: "Relier les blocs", exact: true }).focus();
    await page.keyboard.press("Enter");
    await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
    await editor
      .getByRole("status")
      .getByText(/Structure valide/)
      .waitFor();
    await editor.getByRole("button", { name: "Relier les blocs", exact: true }).click();
    await editor
      .getByRole("status")
      .getByText(/déjà reliée/)
      .waitFor();
    await editor.getByLabel("Ajouter un bloc", { exact: true }).selectOption("text");
    await editor.getByRole("button", { name: "Ajouter le bloc", exact: true }).click();
    await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
    await editor.getByText(/ne contribue à aucun livrable/).waitFor();
    await editor.getByRole("button", { name: "Retirer ce bloc", exact: true }).click();
    const beforeDrag = await exported("nodal-before-drag.json");
    const block = editor.locator(".react-flow__node").first();
    const bounds = await block.boundingBox();
    assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + 70, { steps: 8 });
    await page.mouse.up();
    const afterDrag = await exported("nodal-after-drag.json");
    assert.notDeepEqual(
      afterDrag.workflow.presentation.positions,
      beforeDrag.workflow.presentation.positions,
    );
    assert.deepEqual(afterDrag.workflow.nodes, beforeDrag.workflow.nodes);
    assert.equal(afterDrag.workflow.revision, beforeDrag.workflow.revision);
    await editor
      .getByText("Commencer depuis une consigne, un modèle ou un canevas", { exact: true })
      .click();
    for (const [name, countNodes] of [
      ["Audit → Hermes", 6],
      ["Workflow n8n", 7],
      ["Équipe Paperclip", 6],
    ]) {
      await editor.getByRole("button", { name, exact: true }).click();
      assert.equal(await editor.locator(".react-flow__node").count(), countNodes);
      await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
      await editor
        .getByRole("status")
        .getByText(/Structure valide/)
        .waitFor();
    }
    const team = await exported("nodal-paperclip.json");
    await editor.locator("input[type=file]").setInputFiles({
      name: "forged.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...team, serverContext: { canWrite: true } })),
    });
    await editor
      .getByRole("status")
      .getByText(/champs non autorisés/)
      .waitFor();
    await editor.locator("input[type=file]").setInputFiles({
      name: "restored.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(simple)),
    });
    await editor
      .getByRole("status")
      .getByText(/Brouillon importé/)
      .waitFor();
    assert.equal(await editor.locator(".react-flow__node").count(), 4);
    const restored = await exported("nodal-restored.json");
    assert.deepEqual(restored.workflow, simple.workflow);
    await editor.getByLabel("Point de départ").selectOption("canvas");
    await editor
      .getByRole("button", { name: "Créer un parcours manuel sans moteur", exact: true })
      .click();
    await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
    await editor
      .getByRole("status")
      .getByText(/Structure valide/)
      .waitFor();
    const manual = await exported("nodal-manual.json");
    assert.equal(manual.workflow.presentation.entryMode, "canvas");
    assert.equal(
      manual.workflow.nodes.some((node) => node.kind === "capability"),
      false,
    );
    await editor.getByLabel("Point de départ").selectOption("chat");
    await editor
      .getByLabel("Votre consigne", { exact: true })
      .fill("Préparer un guide pour accueillir les premiers clients.");
    await editor.getByRole("button", { name: "Créer le brouillon", exact: true }).click();
    await editor.getByRole("button", { name: "Vérifier la structure", exact: true }).click();
    await editor
      .getByRole("status")
      .getByText(/Structure valide/)
      .waitFor();
    const fromPrompt = await exported("nodal-from-prompt.json");
    assert.equal(fromPrompt.workflow.presentation.entryMode, "chat");
    assert.equal(fromPrompt.workflow.nodes[0].value.text, fromPrompt.mission.objective);
    await editor
      .getByText("Commencer depuis une consigne, un modèle ou un canevas", { exact: true })
      .click();
    await editor.getByLabel("Vue du workflow").selectOption("advanced");
    await page.screenshot({ path: join(evidence, "optivos-nodal-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await editor.getByLabel("Nom du workflow").scrollIntoViewIfNeeded();
    assert.ok(await editor.evaluate((node) => node.scrollWidth <= node.clientWidth));
    await page.screenshot({ path: join(evidence, "optivos-nodal-mobile.png"), fullPage: true });
    await editor.getByLabel("Bloc à configurer").selectOption(simple.workflow.nodes[0].id);
    await editor
      .getByLabel("Consigne du bloc")
      .fill("Modification mobile à conserver dans le brouillon.");
    page.off("dialog", accept);
    const dismiss = (dialog) => dialog.dismiss();
    page.on("dialog", dismiss);
    await page.keyboard.press("Escape");
    assert.equal(await editor.count(), 1);
    page.off("dialog", dismiss);
    page.on("dialog", accept);
    await exported("nodal-final.json");
    await page.keyboard.press("Escape");
    assert.equal(await editor.count(), 0);
    assert.equal(apiRequests, 0);
    checks.push(
      "nodal: lazy xyflow, four validated recipes, same graph across views, revisioned edits, keyboard connection repair, duplicate refusal and orphan detection, actual drag changes positions only, strict import/export round-trip, mobile overflow and dirty-close guard; zero API requests",
    );
  } finally {
    page.off("request", count);
    page.off("dialog", accept);
  }
}
