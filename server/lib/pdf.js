import { PDFParse, PasswordException, InvalidPDFException } from "pdf-parse";

/** Resumes are a couple of pages; anything larger is not a resume. */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Below this, the "PDF" is almost certainly a scan with no text layer. */
const MIN_USEFUL_CHARS = 80;

/** A PDF we can't read, with a message that tells the user what to do about it. */
export class PdfParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "PdfParseError";
  }
}

/**
 * Extract plain text from a PDF buffer.
 *
 * Throws {@link PdfParseError} with a user-facing message for every way a
 * resume upload realistically fails — encrypted, corrupt, or an image-only scan
 * (which parses "successfully" but yields no text). The route maps this to a
 * 400 so the UI can point the user at the paste box instead.
 */
export async function pdfToText(buffer) {
  // pdf-parse holds a worker open, so it must be destroyed on every path out.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  let raw;
  try {
    ({ text: raw } = await parser.getText());
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new PdfParseError("That PDF is password-protected. Remove the password, or paste your resume text instead.");
    }
    if (err instanceof InvalidPDFException) {
      throw new PdfParseError("That file isn't a valid PDF. Try another file, or paste your resume text instead.");
    }
    throw new PdfParseError("That PDF couldn't be read. Try pasting your resume text instead.");
  } finally {
    await parser.destroy().catch(() => {});
  }

  const text = String(raw || "")
    // pdf-parse marks page boundaries with "-- 1 of 2 --" lines. They're noise
    // in a resume and would otherwise be fed to the model as if they were content.
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_USEFUL_CHARS) {
    throw new PdfParseError(
      "No text found in that PDF — it looks like a scan or an image. Paste your resume text instead."
    );
  }
  return text;
}
