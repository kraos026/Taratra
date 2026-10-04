export const DOCUMENT_LIMITS = { bytes: 256_000, rows: 200, columns: 20, excerpt: 4000 } as const;

export interface DocumentExcerpt {
  location: string;
  text: string;
}

// Only these application-owned messages may be shown to the user; never expose
// arbitrary parser/platform exceptions or document contents in error output.
export class DocumentReadError extends Error {}

export function readDocumentText(fileName: string, text: string): DocumentExcerpt[] {
  if (!fileName.trim() || fileName.length > 160 || /[\\/\x00-\x1f]/.test(fileName))
    throw new DocumentReadError("Renommez le fichier : nom simple de 160 caractères maximum.");
  if (new TextEncoder().encode(text).length > DOCUMENT_LIMITS.bytes)
    throw new DocumentReadError("Fichier trop volumineux : maximum 256 Ko.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/.test(text))
    throw new DocumentReadError(
      "Le fichier doit être un texte UTF-8 lisible, sans contenu binaire.",
    );
  if (/\.txt$/i.test(fileName)) {
    const lines = text.replace(/^\ufeff/, "").split(/\r\n|\n|\r/);
    if (lines.at(-1) === "") lines.pop();
    if (lines.length > DOCUMENT_LIMITS.rows)
      throw new DocumentReadError("Maximum 200 lignes. Importez un extrait du document.");
    return nonempty(lines.map((line, index) => ({ location: `Ligne ${index + 1}`, text: line })));
  }
  if (!/\.csv$/i.test(fileName))
    throw new DocumentReadError(
      "Formats disponibles : TXT et CSV UTF-8. PDF et Excel ne sont pas encore pris en charge.",
    );
  const rows = parseCsv(text.replace(/^\ufeff/, ""));
  const headings = rows[0]?.cells;
  if (!headings || !headings.some((value) => value.trim()))
    throw new DocumentReadError("Le CSV doit contenir une ligne d’en-têtes.");
  if (rows.length < 2) throw new DocumentReadError("Le CSV ne contient aucune ligne de données.");
  const normalizedHeadings = headings.map((heading) => heading.trim().toLocaleLowerCase("fr"));
  if (
    normalizedHeadings.some((heading) => !heading) ||
    new Set(normalizedHeadings).size !== headings.length
  )
    throw new DocumentReadError("Chaque colonne CSV doit avoir un en-tête renseigné et unique.");
  return nonempty(
    rows.slice(1).map((row) => ({
      location:
        row.startLine === row.endLine
          ? `Ligne CSV ${row.startLine}`
          : `Lignes CSV ${row.startLine}–${row.endLine}`,
      text: row.cells.every((cell) => !cell.trim())
        ? ""
        : row.cells
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
  if (!result.length) throw new DocumentReadError("Aucun texte exploitable dans ce fichier.");
  if (result.some((entry) => entry.text.length > DOCUMENT_LIMITS.excerpt))
    throw new DocumentReadError(
      "Une ligne dépasse 4 000 caractères. Importez un extrait plus court.",
    );
  return result;
}

function parseCsv(text: string): { cells: string[]; startLine: number; endLine: number }[] {
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
  const rows: { cells: string[]; startLine: number; endLine: number }[] = [];
  let line = 1;
  let startLine = 1;
  let row: string[] = [];
  let cell = "";
  let state: "plain" | "quoted" | "closed" = "plain";
  const pushCell = () => {
    row.push(cell);
    cell = "";
    state = "plain";
    if (row.length > DOCUMENT_LIMITS.columns)
      throw new DocumentReadError("Maximum 20 colonnes par CSV.");
  };
  const pushRow = () => {
    pushCell();
    // Empty physical lines are not data records; keep original line citations.
    if (row.length !== 1 || row[0].trim()) rows.push({ cells: row, startLine, endLine: line });
    row = [];
    if (rows.length > DOCUMENT_LIMITS.rows)
      throw new DocumentReadError("Maximum 200 lignes, en-tête inclus.");
  };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (state === "quoted") {
      if (character === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else state = "closed";
      } else {
        cell += character;
        if (character === "\r") {
          if (text[i + 1] === "\n") {
            cell += "\n";
            i++;
          }
          line++;
        } else if (character === "\n") line++;
      }
    } else if (character === delimiter) pushCell();
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      line++;
      startLine = line;
    } else if (character === '"' && cell === "" && state === "plain") state = "quoted";
    else if (state === "closed" || character === '"')
      throw new DocumentReadError("CSV invalide : guillemets ou séparateurs incohérents.");
    else cell += character;
  }
  if (state === "quoted") throw new DocumentReadError("CSV invalide : guillemet non fermé.");
  if (cell || row.length || state === "closed") pushRow();
  if (rows.some((candidate) => candidate.cells.length !== rows[0].cells.length))
    throw new DocumentReadError(
      "CSV invalide : les lignes doivent avoir le même nombre de colonnes.",
    );
  return rows;
}
