export const DOCUMENT_LIMITS = { bytes: 256_000, rows: 200, columns: 20, excerpt: 4000 } as const;

export interface DocumentExcerpt {
  location: string;
  text: string;
}

export function readDocumentText(fileName: string, text: string): DocumentExcerpt[] {
  if (new TextEncoder().encode(text).length > DOCUMENT_LIMITS.bytes)
    throw new Error("Fichier trop volumineux : maximum 256 Ko.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/.test(text))
    throw new Error("Le fichier doit être un texte UTF-8 lisible, sans contenu binaire.");
  if (/\.txt$/i.test(fileName)) {
    const lines = text.replace(/^\ufeff/, "").split(/\r\n|\n|\r/);
    if (lines.length > DOCUMENT_LIMITS.rows)
      throw new Error("Maximum 200 lignes. Importez un extrait du document.");
    return nonempty(lines.map((line, index) => ({ location: `Ligne ${index + 1}`, text: line })));
  }
  if (!/\.csv$/i.test(fileName))
    throw new Error(
      "Formats disponibles : TXT et CSV UTF-8. PDF et Excel ne sont pas encore pris en charge.",
    );
  const rows = parseCsv(text.replace(/^\ufeff/, ""));
  const headings = rows[0];
  if (!headings || !headings.some((value) => value.trim()))
    throw new Error("Le CSV doit contenir une ligne d’en-têtes.");
  if (rows.length < 2) throw new Error("Le CSV ne contient aucune ligne de données.");
  return nonempty(
    rows.slice(1).map((row, index) => ({
      location: `Ligne CSV ${index + 2}`,
      text: row.every((cell) => !cell.trim())
        ? ""
        : row
            .map(
              (value, column) =>
                `${headings[column]?.trim() || `Colonne ${column + 1}`} : ${value}`,
            )
            .join(" · "),
    })),
  );
}

function nonempty(excerpts: DocumentExcerpt[]) {
  const result = excerpts.filter((entry) => entry.text.trim());
  if (!result.length) throw new Error("Aucun texte exploitable dans ce fichier.");
  if (result.some((entry) => entry.text.length > DOCUMENT_LIMITS.excerpt))
    throw new Error("Une ligne dépasse 4 000 caractères. Importez un extrait plus court.");
  return result;
}

function parseCsv(text: string): string[][] {
  // Detect delimiter outside quotes on the first logical row; no formula evaluation.
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
    }
    if (!quoted) {
      if (character === "\n" || character === "\r") break;
      if (character === ",") commas++;
      if (character === ";") semicolons++;
    }
  }
  const delimiter = semicolons > commas ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let state: "plain" | "quoted" | "closed" = "plain";
  const pushCell = () => {
    row.push(cell);
    cell = "";
    state = "plain";
    if (row.length > DOCUMENT_LIMITS.columns) throw new Error("Maximum 20 colonnes par CSV.");
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    if (rows.length > DOCUMENT_LIMITS.rows) throw new Error("Maximum 200 lignes, en-tête inclus.");
  };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (state === "quoted") {
      if (character === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else state = "closed";
      } else cell += character;
    } else if (character === delimiter) pushCell();
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (character === '"' && cell === "" && state === "plain") state = "quoted";
    else if (state === "closed" || character === '"')
      throw new Error("CSV invalide : guillemets ou séparateurs incohérents.");
    else cell += character;
  }
  if (state === "quoted") throw new Error("CSV invalide : guillemet non fermé.");
  if (cell || row.length || state === "closed") pushRow();
  if (rows.some((candidate) => candidate.length !== rows[0].length))
    throw new Error("CSV invalide : les lignes doivent avoir le même nombre de colonnes.");
  return rows;
}
