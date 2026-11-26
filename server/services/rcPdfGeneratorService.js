import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

/**
 * Pure Node.js A4 PDF 1.4 Generator for HHK Reading Comprehension Practice & Answer Sheets.
 * - Embeds real HHK logo (client/public/hhk-logo.png) natively as compressed RGB Image XObject.
 * - Two student/admin download formats:
 *   1. "practice" — Examination, Category, Difficulty, Complete Passage, Questions & Options (no answers).
 *   2. "answers"  — Examination, Category, Difficulty, Quick Answer Key Grid, Detailed Explanations,
 *                   Supporting Passage References, and Passage Vocabulary Table.
 * - Zero external npm dependencies; automatic page breaks and buffer integrity verification.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 44;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const TOP_Y = PAGE_H - 54;
const BOTTOM_Y = 52;

const C_NAVY = [0.043, 0.231, 0.549];
const C_NAVY_DARK = [0.031, 0.145, 0.365];
const C_GOLD = [0.898, 0.604, 0.078];
const C_BLUE_BG = [0.941, 0.961, 0.996];
const C_BLUE_BORDER = [0.76, 0.84, 0.96];
const C_SLATE_BG = [0.973, 0.98, 0.988];
const C_BORDER = [0.84, 0.87, 0.91];
const C_GREEN = [0.075, 0.45, 0.22];
const C_GREEN_BG = [0.91, 0.98, 0.93];
const C_TEXT = [0.08, 0.11, 0.17];
const C_MUTED = [0.36, 0.42, 0.51];
const C_WHITE = [1, 1, 1];

export const RC_PDF_FORMATS = ["practice", "answers"];

let cachedLogo = undefined;

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngToRgbDownsampled(filePath, targetSize = 140) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (dataEnd > buf.length) break;
    if (type === "IHDR") {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === "IDAT") {
      idatChunks.push(buf.subarray(dataStart, dataEnd));
    } else if (type === "IEND") break;
    pos = dataEnd + 4;
  }
  if (!width || !height || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null;
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  let inOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[inOffset++];
    const rowOut = y * stride;
    const prevRow = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const xVal = raw[inOffset++];
      const a = x >= bpp ? pixels[rowOut + x - bpp] : 0;
      const b = y > 0 ? pixels[prevRow + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[prevRow + x - bpp] : 0;
      let val = xVal;
      if (filter === 1) val = (xVal + a) & 0xff;
      else if (filter === 2) val = (xVal + b) & 0xff;
      else if (filter === 3) val = (xVal + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (xVal + paethPredictor(a, b, c)) & 0xff;
      pixels[rowOut + x] = val;
    }
  }
  const outW = Math.min(targetSize, width);
  const outH = Math.max(1, Math.round((height / width) * outW));
  const rgbOut = Buffer.alloc(outW * outH * 3);
  for (let oy = 0; oy < outH; oy += 1) {
    const y0 = Math.floor((oy * height) / outH);
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * height) / outH));
    for (let ox = 0; ox < outW; ox += 1) {
      const x0 = Math.floor((ox * width) / outW);
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * width) / outW));
      let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        const rowBase = sy * stride;
        for (let sx = x0; sx < x1; sx += 1) {
          const off = rowBase + sx * bpp;
          const r = pixels[off], g = pixels[off + 1], b = pixels[off + 2];
          if (bpp === 4) {
            const alpha = pixels[off + 3] / 255;
            rSum += r * alpha + 255 * (1 - alpha);
            gSum += g * alpha + 255 * (1 - alpha);
            bSum += b * alpha + 255 * (1 - alpha);
          } else {
            rSum += r; gSum += g; bSum += b;
          }
          cnt += 1;
        }
      }
      const dst = (oy * outW + ox) * 3;
      rgbOut[dst] = Math.round(rSum / cnt);
      rgbOut[dst + 1] = Math.round(gSum / cnt);
      rgbOut[dst + 2] = Math.round(bSum / cnt);
    }
  }
  return { width: outW, height: outH, compressedRgb: zlib.deflateSync(rgbOut, { level: 9 }) };
}

function getHhkLogo() {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(__dirname, "../../client/public/hhk-logo.png"),
      path.resolve(process.cwd(), "client/public/hhk-logo.png"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        cachedLogo = decodePngToRgbDownsampled(p, 140);
        if (cachedLogo) return cachedLogo;
      }
    }
  } catch {}
  cachedLogo = null;
  return null;
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/\u20B9/g, "Rs. ")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pdfEscape(str) {
  return sanitizePdfText(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function approxCharWidth(ch, fontSize, bold = false) {
  const factor = bold ? 0.55 : 0.51;
  if ("ilI.,:;!'| ".includes(ch)) return fontSize * 0.28;
  if ("mwMW@%".includes(ch)) return fontSize * 0.78;
  return fontSize * factor;
}

function measureText(str, fontSize, bold = false) {
  const clean = sanitizePdfText(str);
  let w = 0;
  for (let i = 0; i < clean.length; i += 1) w += approxCharWidth(clean[i], fontSize, bold);
  return w;
}

function wrapText(text, maxWidth, fontSize, bold = false) {
  const rawParagraphs = String(text ?? "").split(/\n+/);
  const lines = [];
  for (const para of rawParagraphs) {
    const clean = sanitizePdfText(para);
    if (!clean) continue;
    const words = clean.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureText(candidate, fontSize, bold) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function rgbFill(c) { return `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} rg`; }
function rgbStroke(c) { return `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} RG`; }

class RcPdfComposer {
  constructor({ title, subtitle, exam, category, difficulty }) {
    this.title = sanitizePdfText(title);
    this.subtitle = sanitizePdfText(subtitle);
    this.exam = sanitizePdfText(exam);
    this.category = sanitizePdfText(category);
    this.difficulty = sanitizePdfText(difficulty).toUpperCase();
    this.logo = getHhkLogo();
    this.pages = [];
    this.cur = [];
    this.y = TOP_Y;
    this.newPage(true);
  }

  newPage(isFirst = false) {
    if (this.cur.length > 0) this.pages.push(this.cur);
    this.cur = [];
    if (isFirst) {
      // HHK Royal Blue Header Band + Gold Accent Bar
      this.rect(0, PAGE_H - 86, PAGE_W, 86, C_NAVY);
      this.rect(0, PAGE_H - 90, PAGE_W, 4, C_GOLD);
      if (this.logo) {
        this.rect(MARGIN_X, PAGE_H - 72, 46, 46, C_WHITE);
        this.cur.push(`q 44 0 0 44 ${MARGIN_X + 1} ${PAGE_H - 71} cm /ImLogo Do Q`);
      }
      const textX = this.logo ? MARGIN_X + 58 : MARGIN_X;
      this.text("HHK BANKING EXAM PREPARATION PLATFORM", textX, PAGE_H - 30, 9.5, true, C_GOLD);
      this.text(this.subtitle, textX, PAGE_H - 48, 15, true, C_WHITE);
      this.text(`${this.exam}  |  ${this.category}  |  Difficulty: ${this.difficulty}`, textX, PAGE_H - 68, 9.5, false, [0.88, 0.92, 1]);
      this.y = PAGE_H - 110;
    } else {
      // Compact Running Header
      this.rect(0, PAGE_H - 36, PAGE_W, 36, C_SLATE_BG);
      this.line(0, PAGE_H - 36, PAGE_W, PAGE_H - 36, C_BORDER, 0.8);
      this.text(`HHK Reading Comprehension  |  ${this.exam} (${this.difficulty})`, MARGIN_X, PAGE_H - 22, 8.5, true, C_NAVY);
      this.y = PAGE_H - 56;
    }
  }

  ensureSpace(neededHeight) {
    if (this.y - neededHeight < BOTTOM_Y) {
      this.newPage(false);
    }
  }

  rect(x, y, w, h, fill = null, stroke = null, lineWidth = 0.7) {
    let cmd = "q ";
    if (fill) cmd += `${rgbFill(fill)} `;
    if (stroke) cmd += `${rgbStroke(stroke)} ${lineWidth} w `;
    cmd += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re `;
    if (fill && stroke) cmd += "B ";
    else if (fill) cmd += "f ";
    else if (stroke) cmd += "S ";
    cmd += "Q";
    this.cur.push(cmd);
  }

  line(x1, y1, x2, y2, stroke = C_BORDER, lineWidth = 0.7) {
    this.cur.push(`q ${rgbStroke(stroke)} ${lineWidth} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  text(str, x, y, size = 10, bold = false, color = C_TEXT) {
    const font = bold ? "/F2" : "/F1";
    this.cur.push(`BT ${font} ${size} Tf ${rgbFill(color)} 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(str)}) Tj ET`);
  }

  sectionHeading(label) {
    this.ensureSpace(32);
    this.rect(MARGIN_X, this.y - 20, CONTENT_W, 22, C_BLUE_BG, C_BLUE_BORDER, 0.6);
    this.rect(MARGIN_X, this.y - 20, 4, 22, C_NAVY);
    this.text(label, MARGIN_X + 12, this.y - 13, 10.5, true, C_NAVY_DARK);
    this.y -= 30;
  }

  paragraphBlock(text, fontSize = 10, lineGap = 14.5) {
    const paras = String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    for (const para of paras) {
      const lines = wrapText(para, CONTENT_W - 8, fontSize, false);
      for (const line of lines) {
        this.ensureSpace(lineGap + 4);
        this.text(line, MARGIN_X + 4, this.y, fontSize, false, C_TEXT);
        this.y -= lineGap;
      }
      this.y -= 6;
    }
  }

  finalizeBuffer() {
    if (this.cur.length > 0) this.pages.push(this.cur);
    const totalPages = this.pages.length;

    // Add page footers to every page
    const finalizedStreams = this.pages.map((cmds, idx) => {
      const footer = [
        `q ${rgbStroke(C_BORDER)} 0.6 w ${MARGIN_X} 36 m ${(PAGE_W - MARGIN_X).toFixed(2)} 36 l S Q`,
        `BT /F1 8 Tf ${rgbFill(C_MUTED)} 1 0 0 1 ${MARGIN_X} 24 Tm (HHK Banking Exam Preparation Platform - Reading Comprehension Module) Tj ET`,
        `BT /F2 8 Tf ${rgbFill(C_NAVY)} 1 0 0 1 ${(PAGE_W - MARGIN_X - 54).toFixed(2)} 24 Tm (Page ${idx + 1} of ${totalPages}) Tj ET`,
      ];
      return [...cmds, ...footer].join("\n");
    });

    const objects = [];
    const addObj = (body) => {
      objects.push(body);
      return objects.length;
    };

    const f1Id = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const f2Id = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    let logoId = null;
    if (this.logo) {
      logoId = addObj({
        dict: `<< /Type /XObject /Subtype /Image /Width ${this.logo.width} /Height ${this.logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${this.logo.compressedRgb.length} >>`,
        stream: this.logo.compressedRgb,
      });
    }

    const pagesPlaceholderIdx = objects.length;
    objects.push(""); // reserved for /Pages
    const pagesId = pagesPlaceholderIdx + 1;

    const pageIds = [];
    for (const streamStr of finalizedStreams) {
      const compressed = zlib.deflateSync(Buffer.from(streamStr, "latin1"));
      const contentId = addObj({
        dict: `<< /Filter /FlateDecode /Length ${compressed.length} >>`,
        stream: compressed,
      });
      const xObjPart = logoId ? ` /XObject << /ImLogo ${logoId} 0 R >>` : "";
      const pageId = addObj(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1Id} 0 R /F2 ${f2Id} 0 R >>${xObjPart} >> /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    }

    objects[pagesPlaceholderIdx] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
    const offsets = [0];
    let byteOffset = chunks[0].length;

    for (let i = 0; i < objects.length; i += 1) {
      offsets.push(byteOffset);
      const obj = objects[i];
      const header = Buffer.from(`${i + 1} 0 obj\n`, "ascii");
      let part;
      if (typeof obj === "string") {
        part = Buffer.concat([header, Buffer.from(`${obj}\nendobj\n`, "ascii")]);
      } else {
        part = Buffer.concat([
          header,
          Buffer.from(`${obj.dict}\nstream\n`, "ascii"),
          obj.stream,
          Buffer.from("\nendstream\nendobj\n", "ascii"),
        ]);
      }
      chunks.push(part);
      byteOffset += part.length;
    }

    const xrefStart = byteOffset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, "ascii"));
    return Buffer.concat(chunks);
  }
}

export function generateReadingComprehensionPdf({ passage, questions = [], vocabulary = [], format = "practice" }) {
  const safeFormat = RC_PDF_FORMATS.includes(format) ? format : "practice";
  const isAnswers = safeFormat === "answers";
  const subtitle = isAnswers
    ? "Reading Comprehension — Answer Key & Detailed Explanations"
    : "Reading Comprehension — Practice Question Paper";

  const doc = new RcPdfComposer({
    title: passage.title,
    subtitle,
    exam: passage.examination,
    category: passage.category,
    difficulty: passage.difficulty,
  });

  // Metadata KPI Strip
  const kpiH = 34;
  doc.rect(MARGIN_X, doc.y - kpiH, CONTENT_W, kpiH, C_SLATE_BG, C_BORDER, 0.7);
  const wordCount = passage.word_count || String(passage.passage_text || "").split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round((passage.recommended_time_seconds || 600) / 60));
  doc.text(`Passage: ${passage.title}`, MARGIN_X + 10, doc.y - 13, 9.5, true, C_NAVY_DARK);
  doc.text(
    `Questions: ${questions.length}   |   Words: ${wordCount}   |   Suggested Time: ${mins} min   |   Format: ${isAnswers ? "Answer & Solutions PDF" : "Practice PDF (No Answers)"}`,
    MARGIN_X + 10,
    doc.y - 26,
    8.5,
    false,
    C_MUTED,
  );
  doc.y -= kpiH + 14;

  if (!isAnswers) {
    // 1. PRACTICE PDF: Complete Passage + All Questions & Options (NO answers)
    doc.sectionHeading("READING PASSAGE");
    doc.paragraphBlock(passage.passage_text, 10, 14.5);
    doc.y -= 6;

    doc.sectionHeading(`QUESTIONS (${questions.length})`);
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const qLines = wrapText(`Q${i + 1}. ${q.question_text}`, CONTENT_W - 8, 10, true);
      const opts = Array.isArray(q.options) ? q.options : [];
      const estHeight = qLines.length * 14 + opts.length * 15 + 24;
      doc.ensureSpace(Math.min(estHeight, 140));

      doc.text(`[${q.question_type}]`, MARGIN_X + 4, doc.y, 8, true, C_MUTED);
      doc.y -= 13;
      for (const line of qLines) {
        doc.ensureSpace(16);
        doc.text(line, MARGIN_X + 4, doc.y, 10, true, C_TEXT);
        doc.y -= 14;
      }
      doc.y -= 2;
      for (const opt of opts) {
        const optLines = wrapText(`(${opt.key}) ${opt.text}`, CONTENT_W - 22, 9.5, false);
        for (const ol of optLines) {
          doc.ensureSpace(15);
          doc.text(ol, MARGIN_X + 16, doc.y, 9.5, false, C_TEXT);
          doc.y -= 13.5;
        }
      }
      doc.y -= 10;
    }
  } else {
    // 2. ANSWER PDF: Quick Answer Key Grid + Detailed Explanations + Passage References + Vocabulary
    doc.sectionHeading("QUICK ANSWER KEY");
    const cols = 5;
    const cellW = CONTENT_W / cols;
    const rowH = 22;
    const totalRows = Math.ceil(questions.length / cols);
    for (let r = 0; r < totalRows; r += 1) {
      doc.ensureSpace(rowH + 6);
      for (let c = 0; c < cols; c += 1) {
        const idx = r * cols + c;
        if (idx >= questions.length) break;
        const x = MARGIN_X + c * cellW;
        doc.rect(x, doc.y - rowH, cellW - 4, rowH - 3, C_GREEN_BG, C_BORDER, 0.5);
        doc.text(`Q${idx + 1}: (${questions[idx].correct_answer})`, x + 10, doc.y - 14, 9.5, true, C_GREEN);
      }
      doc.y -= rowH;
    }
    doc.y -= 10;

    doc.sectionHeading("DETAILED EXPLANATIONS & PASSAGE REFERENCES");
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const opts = Array.isArray(q.options) ? q.options : [];
      const correctOpt = opts.find((o) => o.key === q.correct_answer);
      const qLines = wrapText(`Q${i + 1}. ${q.question_text}`, CONTENT_W - 16, 9.5, true);
      const ansLines = wrapText(
        `Correct Answer: (${q.correct_answer}) ${correctOpt?.text || ""}`,
        CONTENT_W - 16,
        9.5,
        true,
      );
      const expLines = wrapText(`Explanation: ${q.explanation || "Supported directly by the passage."}`, CONTENT_W - 16, 9, false);
      const refLines = q.passage_reference
        ? wrapText(`Passage Reference: "${q.passage_reference}"`, CONTENT_W - 16, 8.5, false)
        : [];

      const boxH = qLines.length * 13 + ansLines.length * 13 + expLines.length * 12.5 + refLines.length * 12 + 24;
      doc.ensureSpace(Math.min(boxH + 10, 180));

      doc.text(`[${q.question_type}]`, MARGIN_X + 6, doc.y, 8, true, C_NAVY);
      doc.y -= 13;
      for (const l of qLines) { doc.ensureSpace(15); doc.text(l, MARGIN_X + 6, doc.y, 9.5, true, C_TEXT); doc.y -= 13; }
      for (const l of ansLines) { doc.ensureSpace(15); doc.text(l, MARGIN_X + 6, doc.y, 9.5, true, C_GREEN); doc.y -= 13; }
      for (const l of expLines) { doc.ensureSpace(14); doc.text(l, MARGIN_X + 6, doc.y, 9, false, C_TEXT); doc.y -= 12.5; }
      for (const l of refLines) { doc.ensureSpace(14); doc.text(l, MARGIN_X + 6, doc.y, 8.5, false, C_MUTED); doc.y -= 12; }
      doc.line(MARGIN_X, doc.y - 3, MARGIN_X + CONTENT_W, doc.y - 3, C_BORDER, 0.5);
      doc.y -= 12;
    }

    if (vocabulary.length > 0) {
      doc.sectionHeading(`PASSAGE VOCABULARY (${vocabulary.length} WORDS)`);
      for (const v of vocabulary) {
        doc.ensureSpace(48);
        doc.text(`${v.word}${v.pronunciation ? `  ${v.pronunciation}` : ""}`, MARGIN_X + 6, doc.y, 9.5, true, C_NAVY_DARK);
        doc.y -= 13;
        const mLines = wrapText(`Meaning: ${v.meaning_english} | Syn: ${v.synonym || "-"} | Ant: ${v.antonym || "-"}`, CONTENT_W - 14, 8.8, false);
        for (const l of mLines) { doc.ensureSpace(14); doc.text(l, MARGIN_X + 10, doc.y, 8.8, false, C_TEXT); doc.y -= 12; }
        if (v.example_sentence) {
          const exLines = wrapText(`Example: ${v.example_sentence}`, CONTENT_W - 14, 8.5, false);
          for (const l of exLines) { doc.ensureSpace(14); doc.text(l, MARGIN_X + 10, doc.y, 8.5, false, C_MUTED); doc.y -= 11.5; }
        }
        doc.y -= 6;
      }
    }
  }

  const buffer = doc.finalizeBuffer();
  const slug = sanitizePdfText(passage.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "rc-passage";
  const fileName = `HHK_RC_${slug}_${isAnswers ? "Answers" : "Practice"}.pdf`;
  return { buffer, fileName, byteLength: buffer.length };
}
