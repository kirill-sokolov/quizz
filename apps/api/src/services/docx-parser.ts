import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface DocxQuestion {
  title: string;
  options: string[];
  correctIndex: number; // 0-3
  explanation: string | null;
}

/**
 * Extract plain text from DOCX file
 * Just extracts all text content, without trying to parse structure
 */
export function extractTextFromDocx(buffer: Buffer): string {
  try {
    const zip = new AdmZip(buffer);
    const docEntry = zip.getEntry("word/document.xml");
    if (!docEntry) {
      throw new Error("Не найден word/document.xml в DOCX файле");
    }

    const xml = docEntry.getData().toString("utf-8");
    const parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
    });

    const doc = parser.parse(xml);

    // Extract all text recursively
    const texts: string[] = [];
    extractTextRecursive(doc, texts);

    return texts.join("\n").trim();
  } catch (err) {
    throw new Error(`Не удалось прочитать DOCX: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function extractTextRecursive(obj: unknown, texts: string[]): void {
  if (!obj) return;

  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (trimmed) texts.push(trimmed);
    return;
  }

  if (typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractTextRecursive(item, texts);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  // Special handling for text nodes
  if ("t" in record && record.t) {
    const text = String(record.t).trim();
    if (text) texts.push(text);
  }

  // Recurse into all properties
  for (const value of Object.values(record)) {
    extractTextRecursive(value, texts);
  }
}

/**
 * Convert DOCX to images (PNG) via PDF intermediate
 * Steps: DOCX → PDF (LibreOffice) → PNG (ImageMagick)
 * @param saveDebugTo - optional path to save debug files (PDF + PNGs)
 */
export async function convertDocxToImages(
  buffer: Buffer,
  saveDebugTo?: string
): Promise<{ data: string; mimeType: string }[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-convert-"));
  try {
    const docxPath = path.join(tmpDir, "document.docx");
    fs.writeFileSync(docxPath, buffer);

    // Step 1: DOCX → PDF using LibreOffice
    console.log("[DOCX] Converting to PDF with LibreOffice...");
    try {
      execSync(
        `soffice --headless --convert-to pdf --outdir "${tmpDir}" "${docxPath}"`,
        { timeout: 30000, stdio: "ignore" }
      );
    } catch (err) {
      throw new Error("LibreOffice not available or conversion failed");
    }

    const pdfPath = path.join(tmpDir, "document.pdf");
    if (!fs.existsSync(pdfPath)) {
      throw new Error("PDF conversion failed - no output file");
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`[DOCX] Generated PDF (${Math.round(pdfBuffer.length / 1024)}KB)`);

    // Save debug PDF if requested
    if (saveDebugTo) {
      fs.mkdirSync(saveDebugTo, { recursive: true });
      const debugPdfPath = path.join(saveDebugTo, "intermediate.pdf");
      fs.writeFileSync(debugPdfPath, pdfBuffer);
      console.log(`[DOCX] Saved intermediate PDF: ${debugPdfPath}`);
    }

    // Step 2: PDF → PNG using ImageMagick with improved settings
    console.log("[DOCX] Converting PDF to PNG with ImageMagick...");
    const outputPattern = path.join(tmpDir, "page-%d.png");
    try {
      // Higher density + white background + quality
      execSync(
        `convert -density 200 -background white -alpha remove "${pdfPath}" -quality 95 "${outputPattern}"`,
        { timeout: 30000, stdio: "ignore" }
      );
    } catch (err) {
      throw new Error("ImageMagick not available or conversion failed");
    }

    // Step 3: Read generated PNG files
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith("page-") && f.endsWith(".png"));
    if (files.length === 0) {
      throw new Error("No images generated from PDF");
    }

    files.sort((a, b) => {
      const numA = parseInt(a.match(/page-(\d+)\.png/)?.[1] || "0");
      const numB = parseInt(b.match(/page-(\d+)\.png/)?.[1] || "0");
      return numA - numB;
    });

    console.log(`[DOCX] Generated ${files.length} PNG images`);

    // Step 4: Encode as base64
    const images: { data: string; mimeType: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imagePath = path.join(tmpDir, file);
      const imageBuffer = fs.readFileSync(imagePath);

      // Save debug PNG if requested
      if (saveDebugTo) {
        const debugPngPath = path.join(saveDebugTo, `page-${i + 1}.png`);
        fs.writeFileSync(debugPngPath, imageBuffer);
        console.log(`[DOCX] Saved debug PNG: ${debugPngPath}`);
      }

      images.push({
        data: imageBuffer.toString("base64"),
        mimeType: "image/png",
      });
    }

    return images;
  } finally {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
