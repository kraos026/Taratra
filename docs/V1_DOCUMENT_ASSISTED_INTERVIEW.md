# V1 — Documents d’appui à l’entretien

Status: PARTIAL, not release-certified. Canonical owner: Interview → Enterprise Knowledge.

The active interview offers a local TXT/CSV UTF-8 reader for text questions. Users select
one cited line, explicitly review its relevance, edit the resulting answer and submit it
through the existing interview API. Importing/selecting a document performs no remote
write. Selecting an excerpt defaults the answer to uncertain; normal interview completion
and owner/admin validation remain required. Documents never authorize automation or
populate financial estimates automatically.

Limits: 256,000 bytes; 200 lines/logical CSV records (header included); 20 columns;
4,000 characters per excerpt. Invalid UTF-8, binary content, malformed CSV, unsupported
formats and excessive inputs fail closed without silent truncation. CSV formulas and
instructions remain inert text. No file renderer, OCR, macro execution, embedding,
Kimi call or external document processor is used. PDF/XLSX are explicitly unsupported;
CSV export is an interim path, not an equivalent full-featured Excel reader.

CSV citations identify physical source lines, including ranges for multiline quoted
cells. Blank physical CSV lines are ignored without shifting citations. Column headings
must be nonblank and unique (case-insensitive) to avoid ambiguous attribution. A terminal
TXT newline does not count as another line. Invalid filenames are rejected, never
silently shortened. Import errors display only application-owned French messages;
unexpected platform errors use a generic message without document content.

Original files are held only in component memory, not uploaded or stored in browser
storage. Removing the local document or leaving the page discards this copy. Selected
excerpts are copied into the draft answer; removing a file does not delete a draft or
previously saved answer. Users can remove the attached citation before saving.

On answer save, optional `documentSource` metadata (filename, local SHA-256, line,
excerpt, explicit review flag) is stored in the existing tenant-scoped interview decision
audit record in the same authenticated transaction as the answer. The server validates
shape/limits, not authenticity: client-supplied hashes and citations are user attestations,
not trusted proof. Engine input is still the ordinary answer, not this audit metadata.
No schema, grant, RLS policy, migration or knowledge projection contract changes.

Saved citations are read back from the latest tenant-scoped answered decision and shown
in interview review. A newer ordinary answer clears the visible citation; skipped answers
never show it. Original audit history is retained, not deleted by removing a local file.
The citation is not yet a downstream clickable document or a document library.
Original document deletion/retention workflows, PDF/Excel parsers,
downstream source presentation and exact-SHA DB/E2E/staging certification remain closure
items. Do not claim a full document ingestion/understanding system or production readiness.

Verification coverage: parser/schema/service/repository tests; browser file selection and
explicit save gate (mocked API); canonical LOCAL runner attaches one synthetic excerpt
without altering its existing fixture answer, verifies persisted audit provenance and
authenticated read-back, then continues all twelve original stages.
