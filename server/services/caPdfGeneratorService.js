import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

/**
 * Publication-Grade Pure Node.js A4 PDF 1.4 Generator for HHK Current Affairs Practice Papers.
 * - Embeds the real HHK logo (client/public/hhk-logo.png) natively as a compressed RGB Image XObject.
 * - Royal Blue (#0B3B8C) + Gold (#E59A14) HHK brand system, clean typography, smart 1/2-col options,
 *   metadata KPI strip, answer key grid, rich solution cards, and Cover Page for Complete Booklet.
 * - Zero external npm dependencies; validates every generated PDF buffer before returning.
 */

const PAGE_W = 595.28; // A4 width in pt
const PAGE_H = 841.89; // A4 height in pt
const MARGIN_X = 44;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const TOP_Y = PAGE_H - 54;
const BOTTOM_Y = 52;

// HHK Brand Palette (normalized 0..1 RGB)
const C_NAVY = [0.043, 0.231, 0.549];      // #0B3B8C (HHK Royal Blue)
const C_NAVY_DARK = [0.031, 0.145, 0.365]; // #08255D
const C_GOLD = [0.898, 0.604, 0.078];      // #E59A14 (HHK Gold)
const C_GOLD_BG = [0.996, 0.976, 0.922];   // #FEF9EB
const C_BLUE_BG = [0.941, 0.961, 0.996];   // #F0F5FE
const C_BLUE_BORDER = [0.76, 0.84, 0.96];
const C_SLATE_BG = [0.973, 0.98, 0.988];   // #F8FAFC
const C_BORDER = [0.84, 0.87, 0.91];
const C_GREEN = [0.075, 0.45, 0.22];       // #137338
const C_GREEN_BG = [0.91, 0.98, 0.93];
const C_TEXT = [0.08, 0.11, 0.17];
const C_MUTED = [0.36, 0.42, 0.51];
const C_WHITE = [1, 1, 1];

export const SUPPORTED_PDF_FORMATS = [
  "questions_only",
  "answer_key",
  "detailed_solutions",
  "complete_booklet",
];

// ============================================================================
// Pure Node.js PNG Decoder & Downsampler for Real HHK Logo (RGB FlateDecode)
// ============================================================================
let cachedLogoXObject = undefined;

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngToRgbDownsampled(filePath, targetSize = 160) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
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
    } else if (type === "IEND") {
      break;
    }
    pos = dataEnd + 4;
  }

  // Support 8-bit RGB (colorType 2) and RGBA (colorType 6)
  if (!width || !height || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    return null;
  }
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

  // Downsample with 2x2 box averaging onto white background (handles RGBA cleanly too)
  const outW = Math.min(targetSize, width);
  const outH = Math.max(1, Math.round((outW * height) / width));
  const rgbOut = Buffer.alloc(outW * outH * 3);

  for (let oy = 0; oy < outH; oy += 1) {
    const sy0 = Math.floor((oy * height) / outH);
    const sy1 = Math.min(height - 1, Math.max(sy0, Math.floor(((oy + 1) * height) / outH) - 1));
    for (let ox = 0; ox < outW; ox += 1) {
      const sx0 = Math.floor((ox * width) / outW);
      const sx1 = Math.min(width - 1, Math.max(sx0, Math.floor(((ox + 1) * width) / outW) - 1));

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      const stepY = Math.max(1, Math.floor((sy1 - sy0 + 1) / 3));
      const stepX = Math.max(1, Math.floor((sx1 - sx0 + 1) / 3));

      for (let sy = sy0; sy <= sy1; sy += stepY) {
        const rowBase = sy * stride;
        for (let sx = sx0; sx <= sx1; sx += stepX) {
          const idx = rowBase + sx * bpp;
          let r = pixels[idx];
          let g = pixels[idx + 1];
          let b = pixels[idx + 2];
          if (bpp === 4) {
            const alpha = pixels[idx + 3] / 255;
            r = Math.round(r * alpha + 255 * (1 - alpha));
            g = Math.round(g * alpha + 255 * (1 - alpha));
            b = Math.round(b * alpha + 255 * (1 - alpha));
          }
          rSum += r;
          gSum += g;
          bSum += b;
          count += 1;
        }
      }
      const dst = (oy * outW + ox) * 3;
      rgbOut[dst] = Math.round(rSum / count);
      rgbOut[dst + 1] = Math.round(gSum / count);
      rgbOut[dst + 2] = Math.round(bSum / count);
    }
  }

  return {
    width: outW,
    height: outH,
    compressed: zlib.deflateSync(rgbOut, { level: 6 }),
  };
}

function loadHhkLogo() {
  if (cachedLogoXObject !== undefined) return cachedLogoXObject;
  try {
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const candidates = [
      path.join(projectRoot, "client", "public", "hhk-logo.png"),
      path.join(projectRoot, "client", "public", "logo.png"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const decoded = decodePngToRgbDownsampled(p, 160);
        if (decoded) {
          cachedLogoXObject = decoded;
          return cachedLogoXObject;
        }
      }
    }
  } catch {
    // Gracefully fall back to text branding if logo file is absent
  }
  cachedLogoXObject = null;
  return null;
}

// ============================================================================
// Text Sanitization & Word Wrapping
// ============================================================================
function sanitizePdfText(input) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/₹/g, "Rs. ")
    .replace(/•/g, "*")
    .replace(/[^\x0A\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ");
}

function escapePdfString(str) {
  return sanitizePdfText(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text, fontSize, maxWidthPt) {
  const avgCharWidth = fontSize * 0.515;
  const maxChars = Math.max(16, Math.floor(maxWidthPt / avgCharWidth));
  const paragraphs = sanitizePdfText(text).split("\n");
  const lines = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (!current) {
        if (word.length <= maxChars) {
          current = word;
        } else {
          for (let i = 0; i < word.length; i += maxChars) {
            lines.push(word.slice(i, i + maxChars));
          }
        }
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function formatDateIso(val) {
  if (!val) return "";
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const isoMatch = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

function formatDateRange(practiceSet) {
  const from = formatDateIso(practiceSet.date_from);
  const to = formatDateIso(practiceSet.date_to);
  if (from && to && from !== to) return `${from} to ${to}`;
  return to || from || new Date().toISOString().slice(0, 10);
}

// ============================================================================
// A4 PDF Layout Builder
// ============================================================================
class A4PdfBuilder {
  constructor({ headerTitle = "HHK Banking Exam Preparation", formatBadge = "" } = {}) {
    this.headerTitle = sanitizePdfText(headerTitle).slice(0, 68);
    this.formatBadge = sanitizePdfText(formatBadge).slice(0, 32);
    this.logo = loadHhkLogo();
    this.pages = [];
    this.currentOps = [];
    this.y = TOP_Y;
    this.isCoverPage = false;
  }

  newPage({ isCover = false } = {}) {
    if (this.currentOps.length > 0) {
      this.pages.push({ ops: this.currentOps, isCover: this.isCoverPage });
    }
    this.currentOps = [];
    this.isCoverPage = isCover;
    this.y = TOP_Y;
  }

  ensureSpace(neededPt) {
    if (this.y - neededPt < BOTTOM_Y) {
      this.newPage();
    }
  }

  drawRect(x, y, w, h, rgbFill, rgbStroke = null, strokeWidth = 0.75) {
    this.currentOps.push("q");
    if (rgbFill) {
      const [r, g, b] = rgbFill;
      this.currentOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    }
    if (rgbStroke) {
      const [sr, sg, sb] = rgbStroke;
      this.currentOps.push(`${sr.toFixed(3)} ${sg.toFixed(3)} ${sb.toFixed(3)} RG ${strokeWidth} w`);
    }
    const op = rgbFill && rgbStroke ? "B" : rgbFill ? "f" : "S";
    this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op} Q`);
  }

  drawLine(x1, y1, x2, y2, rgb = C_BORDER, width = 0.6) {
    const [r, g, b] = rgb;
    this.currentOps.push(
      `q ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`,
    );
  }

  drawLogo(x, y, sizePt) {
    if (!this.logo) return;
    // White emblem frame behind logo so blue+gold HHK logo pops cleanly on navy headers
    this.drawRect(x - 2, y - 2, sizePt + 4, sizePt + 4, C_WHITE, C_GOLD, 0.9);
    this.currentOps.push(
      `q ${sizePt.toFixed(2)} 0 0 ${sizePt.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`,
    );
  }

  drawTextLine(text, x, y, { font = "F1", size = 10, color = C_TEXT } = {}) {
    const [r, g, b] = color;
    this.currentOps.push(
      `BT /${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfString(text)}) Tj ET`,
    );
  }

  addParagraph(
    text,
    { font = "F1", size = 10, color = C_TEXT, indent = 0, maxWidth = null, lineGap = 4.5, spaceAfter = 5 } = {},
  ) {
    const w = maxWidth ?? CONTENT_W - indent;
    const lines = wrapText(text, size, w);
    const lineH = size + lineGap;
    for (const line of lines) {
      this.ensureSpace(lineH);
      if (line) {
        this.drawTextLine(line, MARGIN_X + indent, this.y, { font, size, color });
      }
      this.y -= lineH;
    }
    this.y -= spaceAfter;
  }

  addSectionHeading(title, subtitle = "") {
    this.ensureSpace(36);
    this.y -= 4;
    const barH = subtitle ? 30 : 22;
    this.drawRect(MARGIN_X, this.y - barH + 8, CONTENT_W, barH, C_BLUE_BG, C_BLUE_BORDER, 0.7);
    this.drawRect(MARGIN_X, this.y - barH + 8, 4, barH, C_NAVY);
    this.drawTextLine(title, MARGIN_X + 12, this.y - 5, { font: "F2", size: 11, color: C_NAVY });
    if (subtitle) {
      this.drawTextLine(subtitle, MARGIN_X + 12, this.y - 17, { font: "F1", size: 8.5, color: C_MUTED });
    }
    this.y -= barH + 8;
  }

  addBrandHeaderWithKpis({ title, formatTitle, dateLabel, totalQuestions, durationMinutes, marksStr }) {
    const bannerH = 66;
    const bannerBottom = this.y - bannerH + 10;
    this.drawRect(MARGIN_X, bannerBottom, CONTENT_W, bannerH, C_NAVY);
    this.drawRect(MARGIN_X, bannerBottom - 3, CONTENT_W, 3, C_GOLD);

    const textStartX = this.logo ? MARGIN_X + 64 : MARGIN_X + 14;
    if (this.logo) {
      this.drawLogo(MARGIN_X + 10, bannerBottom + 9, 46);
    }

    this.drawTextLine("HHK BANKING EXAMINATION PREPARATION PLATFORM", textStartX, bannerBottom + 50, {
      font: "F2",
      size: 8.2,
      color: [0.98, 0.87, 0.56],
    });
    const titleLines = wrapText(title, 13, PAGE_W - MARGIN_X - textStartX - 10).slice(0, 2);
    this.drawTextLine(titleLines[0] || "Current Affairs Practice Paper", textStartX, bannerBottom + 33, {
      font: "F2",
      size: 13,
      color: C_WHITE,
    });
    this.drawTextLine(formatTitle, textStartX, bannerBottom + 15, {
      font: "F1",
      size: 9.5,
      color: [0.85, 0.91, 1],
    });

    this.y = bannerBottom - 12;

    // 4-cell KPI metadata bar
    const cells = [
      { label: "CURRENT AFFAIRS DATE", value: dateLabel },
      { label: "TOTAL QUESTIONS", value: `${totalQuestions} Questions` },
      { label: "DURATION", value: `${durationMinutes} Minutes` },
      { label: "MARKING SCHEME", value: marksStr },
    ];
    const cellW = CONTENT_W / 4;
    const cellH = 30;
    for (let i = 0; i < cells.length; i += 1) {
      const cx = MARGIN_X + i * cellW;
      this.drawRect(cx, this.y - cellH, cellW - 4, cellH, C_SLATE_BG, C_BORDER, 0.6);
      this.drawTextLine(cells[i].label, cx + 8, this.y - 10, { font: "F2", size: 6.8, color: C_MUTED });
      this.drawTextLine(cells[i].value, cx + 8, this.y - 23, { font: "F2", size: 9.2, color: C_NAVY_DARK });
    }
    this.y -= cellH + 12;
  }

  addInstructionsBox(instructionsText) {
    const lines = wrapText(instructionsText, 9, CONTENT_W - 22);
    const boxH = Math.max(26, lines.length * 13 + 16);
    this.ensureSpace(boxH + 8);
    const boxBottom = this.y - boxH;
    this.drawRect(MARGIN_X, boxBottom, CONTENT_W, boxH, C_GOLD_BG, [0.93, 0.82, 0.56], 0.7);
    this.drawRect(MARGIN_X, boxBottom, 3.5, boxH, C_GOLD);
    this.drawTextLine("INSTRUCTIONS FOR ASPIRANTS", MARGIN_X + 10, this.y - 11, {
      font: "F2",
      size: 8,
      color: [0.58, 0.36, 0.04],
    });
    let ty = this.y - 23;
    for (const ln of lines) {
      this.drawTextLine(ln, MARGIN_X + 10, ty, { font: "F1", size: 9, color: C_TEXT });
      ty -= 12.5;
    }
    this.y = boxBottom - 12;
  }

  finalize() {
    if (this.currentOps.length > 0) {
      this.pages.push({ ops: this.currentOps, isCover: this.isCoverPage });
    }
    if (!this.pages.length) {
      this.pages.push({ ops: [], isCover: false });
    }

    const totalPages = this.pages.length;
    const objects = []; // Each element is a Buffer
    const addObj = (body) => {
      objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8"));
      return objects.length;
    };

    // Reserve fixed IDs: 1=Catalog, 2=Pages, 3=F1, 4=F2, 5=F3
    addObj("");
    addObj("");
    addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

    // Optional Logo Image XObject (ID 6)
    let logoObjId = null;
    if (this.logo) {
      const header = Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${this.logo.width} /Height ${this.logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${this.logo.compressed.length} >>\nstream\n`,
        "utf8",
      );
      const footer = Buffer.from("\nendstream", "utf8");
      logoObjId = addObj(Buffer.concat([header, this.logo.compressed, footer]));
    }

    const xObjResource = logoObjId ? `/XObject << /Im1 ${logoObjId} 0 R >>` : "";
    const pageObjIds = [];

    for (let i = 0; i < totalPages; i += 1) {
      const page = this.pages[i];
      const pageNum = i + 1;
      const chromeOps = [];

      if (!page.isCover) {
        // Subtle running top header with gold accent rule
        chromeOps.push(
          `BT /F2 8 Tf ${C_NAVY[0].toFixed(3)} ${C_NAVY[1].toFixed(3)} ${C_NAVY[2].toFixed(3)} rg ${MARGIN_X} ${(PAGE_H - 26).toFixed(2)} Td (${escapePdfString(this.headerTitle)}) Tj ET`,
        );
        if (this.formatBadge) {
          const badgeX = PAGE_W - MARGIN_X - this.formatBadge.length * 4.3;
          chromeOps.push(
            `BT /F1 8 Tf ${C_MUTED[0].toFixed(3)} ${C_MUTED[1].toFixed(3)} ${C_MUTED[2].toFixed(3)} rg ${badgeX.toFixed(2)} ${(PAGE_H - 26).toFixed(2)} Td (${escapePdfString(this.formatBadge)}) Tj ET`,
          );
        }
        chromeOps.push(
          `q ${C_GOLD[0].toFixed(3)} ${C_GOLD[1].toFixed(3)} ${C_GOLD[2].toFixed(3)} RG 0.9 w ${MARGIN_X} ${(PAGE_H - 32).toFixed(2)} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${(PAGE_H - 32).toFixed(2)} l S Q`,
        );
      }

      // Running footer with page numbers
      chromeOps.push(
        `q ${C_BORDER[0].toFixed(3)} ${C_BORDER[1].toFixed(3)} ${C_BORDER[2].toFixed(3)} RG 0.6 w ${MARGIN_X} 38 m ${(PAGE_W - MARGIN_X).toFixed(2)} 38 l S Q`,
      );
      chromeOps.push(
        `BT /F1 8 Tf ${C_MUTED[0].toFixed(3)} ${C_MUTED[1].toFixed(3)} ${C_MUTED[2].toFixed(3)} rg ${MARGIN_X} 24 Td (HHK Banking Exam Preparation Platform  |  AI Current Affairs Practice Series) Tj ET`,
      );
      const pgLabel = `Page ${pageNum} of ${totalPages}`;
      chromeOps.push(
        `BT /F2 8.2 Tf ${C_NAVY[0].toFixed(3)} ${C_NAVY[1].toFixed(3)} ${C_NAVY[2].toFixed(3)} rg ${(PAGE_W - MARGIN_X - 58).toFixed(2)} 24 Td (${escapePdfString(pgLabel)}) Tj ET`,
      );

      const streamContent = [...chromeOps, ...page.ops].join("\n");
      const streamBytes = Buffer.byteLength(streamContent, "utf8");
      const contentObjId = addObj(`<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream`);
      const pageObjId = addObj(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${xObjResource} >> /Contents ${contentObjId} 0 R >>`,
      );
      pageObjIds.push(pageObjId);
    }

    objects[0] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "utf8");
    objects[1] = Buffer.from(
      `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`,
      "utf8",
    );

    const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
    let offset = chunks[0].length;
    const offsets = [0];

    for (let i = 0; i < objects.length; i += 1) {
      offsets.push(offset);
      const prefix = Buffer.from(`${i + 1} 0 obj\n`, "utf8");
      const suffix = Buffer.from("\nendobj\n", "utf8");
      const combined = Buffer.concat([prefix, objects[i], suffix]);
      chunks.push(combined);
      offset += combined.length;
    }

    const xrefStart = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    chunks.push(Buffer.from(xref + trailer, "utf8"));

    return Buffer.concat(chunks);
  }
}

// ============================================================================
// Content Section Renderers
// ============================================================================
function renderQuestionsBlock(pdf, questions) {
  for (let idx = 0; idx < questions.length; idx += 1) {
    const q = questions[idx];
    const opts = Array.isArray(q.options) ? q.options : [];
    const stemLines = wrapText(q.question_text, 10.4, CONTENT_W - 10);
    const allShortOpts = opts.length >= 4 && opts.every((o) => String(o.option_text || o.text || "").length <= 34);
    const estHeight = 24 + stemLines.length * 15 + (allShortOpts ? Math.ceil(opts.length / 2) * 19 : opts.length * 18) + 18;

    pdf.ensureSpace(Math.min(estHeight, 180));

    // Question header bar: Q-number pill + difficulty/category/format meta
    const pillLabel = `Q${idx + 1}`;
    const pillW = idx >= 99 ? 34 : idx >= 9 ? 28 : 24;
    pdf.drawRect(MARGIN_X, pdf.y - 12, pillW, 16, C_NAVY);
    pdf.drawTextLine(pillLabel, MARGIN_X + 5.5, pdf.y - 7.5, { font: "F2", size: 9, color: C_WHITE });

    const metaParts = [
      String(q.difficulty || "moderate").toUpperCase(),
      String(q.question_type || "mcq").replace(/_/g, " ").toUpperCase(),
      q.category_name || "",
    ].filter(Boolean);
    pdf.drawTextLine(metaParts.join("  |  "), MARGIN_X + pillW + 8, pdf.y - 7.5, {
      font: "F2",
      size: 7.8,
      color: C_MUTED,
    });
    pdf.y -= 24;

    // Question stem
    pdf.addParagraph(q.question_text, {
      font: "F2",
      size: 10.4,
      color: C_TEXT,
      lineGap: 4.5,
      spaceAfter: 6,
    });

    // Smart 2-column grid for short options, clean 1-column list for long options
    if (allShortOpts) {
      const colW = (CONTENT_W - 12) / 2;
      for (let i = 0; i < opts.length; i += 2) {
        pdf.ensureSpace(20);
        const left = opts[i];
        const right = opts[i + 1];

        pdf.drawRect(MARGIN_X + 4, pdf.y - 11, colW - 4, 16, C_SLATE_BG, C_BORDER, 0.5);
        pdf.drawTextLine(
          `(${left.option_label || left.key})  ${left.option_text || left.text}`,
          MARGIN_X + 10,
          pdf.y - 6.5,
          { font: "F1", size: 9.5, color: C_TEXT },
        );

        if (right) {
          const rx = MARGIN_X + colW + 8;
          pdf.drawRect(rx, pdf.y - 11, colW - 4, 16, C_SLATE_BG, C_BORDER, 0.5);
          pdf.drawTextLine(
            `(${right.option_label || right.key})  ${right.option_text || right.text}`,
            rx + 6,
            pdf.y - 6.5,
            { font: "F1", size: 9.5, color: C_TEXT },
          );
        }
        pdf.y -= 20;
      }
    } else {
      for (const opt of opts) {
        pdf.addParagraph(`(${opt.option_label || opt.key})  ${opt.option_text || opt.text}`, {
          font: "F1",
          size: 9.8,
          indent: 12,
          lineGap: 3.5,
          spaceAfter: 3,
        });
      }
    }

    pdf.y -= 4;
    pdf.drawLine(MARGIN_X, pdf.y, PAGE_W - MARGIN_X, pdf.y, [0.89, 0.91, 0.94], 0.5);
    pdf.y -= 10;
  }
}

function renderAnswerKeyBlock(pdf, questions) {
  pdf.addSectionHeading("OFFICIAL ANSWER KEY", "Verify your marked responses before reading detailed solutions");
  const cols = 5;
  const colW = CONTENT_W / cols;
  const rows = Math.ceil(questions.length / cols);

  for (let r = 0; r < rows; r += 1) {
    pdf.ensureSpace(24);
    for (let c = 0; c < cols; c += 1) {
      const idx = r * cols + c;
      if (idx >= questions.length) break;
      const q = questions[idx];
      const x = MARGIN_X + c * colW;
      pdf.drawRect(x + 2, pdf.y - 15, colW - 5, 19, C_GREEN_BG, [0.72, 0.89, 0.77], 0.6);
      pdf.drawTextLine(`Q${idx + 1}`, x + 10, pdf.y - 9, { font: "F2", size: 9, color: C_NAVY_DARK });
      pdf.drawTextLine(`Option (${q.correct_answer})`, x + 36, pdf.y - 9, { font: "F2", size: 9.2, color: C_GREEN });
    }
    pdf.y -= 23;
  }
  pdf.y -= 8;
}

function renderDetailedSolutionsBlock(pdf, questions) {
  pdf.addSectionHeading("DETAILED SOLUTIONS & EXAM EXPLANATIONS", "Complete concept breakdown, distractor analysis, and exam-ready facts");
  for (let idx = 0; idx < questions.length; idx += 1) {
    const q = questions[idx];
    const opts = Array.isArray(q.options) ? q.options : [];
    const correctOpt = opts.find((o) => (o.option_label || o.key) === q.correct_answer);
    const correctOptText = correctOpt ? (correctOpt.option_text || correctOpt.text || "") : "";

    pdf.ensureSpace(96);

    // Question title with navy pill
    const pillLabel = `Q${idx + 1}`;
    const pillW = idx >= 99 ? 34 : idx >= 9 ? 28 : 24;
    pdf.drawRect(MARGIN_X, pdf.y - 12, pillW, 16, C_NAVY);
    pdf.drawTextLine(pillLabel, MARGIN_X + 5.5, pdf.y - 7.5, { font: "F2", size: 9, color: C_WHITE });
    pdf.drawTextLine(
      `${q.category_name || "Current Affairs"}  |  ${String(q.difficulty || "moderate").toUpperCase()}`,
      MARGIN_X + pillW + 8,
      pdf.y - 7.5,
      { font: "F2", size: 8, color: C_MUTED },
    );
    pdf.y -= 22;

    pdf.addParagraph(q.question_text, { font: "F2", size: 10, color: C_TEXT, spaceAfter: 5 });

    // Green Correct Answer Banner
    const ansText = `Correct Answer: Option (${q.correct_answer})${correctOptText ? ` — ${correctOptText}` : ""}`;
    const ansLines = wrapText(ansText, 9.6, CONTENT_W - 18);
    const ansBoxH = ansLines.length * 13 + 8;
    pdf.ensureSpace(ansBoxH + 6);
    pdf.drawRect(MARGIN_X, pdf.y - ansBoxH + 8, CONTENT_W, ansBoxH, C_GREEN_BG, [0.7, 0.88, 0.76], 0.6);
    pdf.drawRect(MARGIN_X, pdf.y - ansBoxH + 8, 3.5, ansBoxH, C_GREEN);
    let ay = pdf.y - 3;
    for (const ln of ansLines) {
      pdf.drawTextLine(ln, MARGIN_X + 10, ay, { font: "F2", size: 9.6, color: C_GREEN });
      ay -= 13;
    }
    pdf.y -= ansBoxH + 4;

    if (q.detailed_explanation) {
      pdf.addParagraph(`Explanation: ${q.detailed_explanation}`, { font: "F1", size: 9.5, indent: 6, spaceAfter: 4 });
    }
    if (q.why_correct) {
      pdf.addParagraph(`Why Correct: ${q.why_correct}`, { font: "F1", size: 9.2, indent: 6, color: C_NAVY_DARK, spaceAfter: 4 });
    }
    const others =
      q.why_others_incorrect && typeof q.why_others_incorrect === "object"
        ? Object.entries(q.why_others_incorrect).filter(([, v]) => Boolean(v))
        : [];
    if (others.length) {
      pdf.addParagraph(
        `Elimination Guide: ${others.map(([k, v]) => `(${k}) ${v}`).join("  |  ")}`,
        { font: "F1", size: 9, indent: 6, color: [0.42, 0.2, 0.2], spaceAfter: 4 },
      );
    }
    const facts = Array.isArray(q.important_facts) ? q.important_facts.filter(Boolean) : [];
    if (facts.length) {
      pdf.addParagraph(`Key Revision Facts: ${facts.join("  *  ")}`, {
        font: "F2",
        size: 8.9,
        indent: 6,
        color: C_NAVY,
        spaceAfter: 4,
      });
    }
    if (q.source_reference) {
      pdf.addParagraph(`Source: ${q.source_reference}`, {
        font: "F3",
        size: 8.4,
        indent: 6,
        color: C_MUTED,
        spaceAfter: 6,
      });
    }

    pdf.drawLine(MARGIN_X, pdf.y + 2, PAGE_W - MARGIN_X, pdf.y + 2, C_BORDER, 0.5);
    pdf.y -= 10;
  }
}

// ============================================================================
// Main Entry Point (All 4 PDF Formats)
// ============================================================================
export function generatePracticeSetPdf({ practiceSet, questions = [], format = "questions_only" }) {
  if (!SUPPORTED_PDF_FORMATS.includes(format)) {
    throw Object.assign(new Error(`Unsupported PDF format: ${format}`), { status: 400 });
  }
  const dateLabel = formatDateRange(practiceSet);
  const title = practiceSet.title || "HHK Current Affairs Practice Set";
  const marksStr = `+${practiceSet.marks_per_question ?? 1} / -${practiceSet.negative_marking ?? 0.25}`;
  const durationMinutes = practiceSet.duration_minutes || 15;

  const formatTitles = {
    questions_only: "Questions Paper (Practice Mode — Answers Hidden)",
    answer_key: "Questions Paper with Official Answer Key",
    detailed_solutions: "Detailed Solutions & Banking Exam Explanations",
    complete_booklet: "Complete Practice Booklet",
  };

  const pdf = new A4PdfBuilder({
    headerTitle: `HHK  |  ${title}`,
    formatBadge: dateLabel,
  });

  if (format === "complete_booklet") {
    // Dedicated Cover Page with Real HHK Logo
    pdf.newPage({ isCover: true });
    pdf.drawRect(0, PAGE_H - 290, PAGE_W, 290, C_NAVY);
    pdf.drawRect(0, PAGE_H - 297, PAGE_W, 7, C_GOLD);

    if (pdf.logo) {
      pdf.drawLogo((PAGE_W - 92) / 2, PAGE_H - 126, 92);
    }

    pdf.drawTextLine("HHK BANKING EXAMINATION PREPARATION PLATFORM", MARGIN_X, PAGE_H - 156, {
      font: "F2",
      size: 10.5,
      color: [0.98, 0.87, 0.56],
    });
    const coverTitleLines = wrapText(title, 20, CONTENT_W).slice(0, 3);
    let cy = PAGE_H - 188;
    for (const line of coverTitleLines) {
      pdf.drawTextLine(line, MARGIN_X, cy, { font: "F2", size: 20, color: C_WHITE });
      cy -= 26;
    }
    pdf.drawTextLine("COMPLETE PRACTICE BOOKLET  *  QUESTIONS  *  ANSWER KEY  *  SOLUTIONS  *  REVISION", MARGIN_X, PAGE_H - 270, {
      font: "F2",
      size: 8.8,
      color: [0.85, 0.92, 1],
    });

    // Metadata Card Grid on Cover
    pdf.y = PAGE_H - 330;
    const examsStr = (
      Array.isArray(practiceSet.target_exams) && practiceSet.target_exams.length
        ? practiceSet.target_exams
        : ["IBPS PO", "SBI PO", "IBPS Clerk", "RBI Grade B"]
    ).join(", ");
    const metaCards = [
      { label: "CURRENT AFFAIRS DATE", value: dateLabel },
      { label: "PRACTICE SET TYPE", value: String(practiceSet.set_type || "daily").replace(/_/g, " ").toUpperCase() },
      { label: "TOTAL QUESTIONS & MARKS", value: `${questions.length} Questions  (${practiceSet.total_marks || questions.length} Marks)` },
      { label: "DURATION & MARKING", value: `${durationMinutes} Minutes  |  ${marksStr}` },
    ];
    const halfW = (CONTENT_W - 10) / 2;
    for (let i = 0; i < metaCards.length; i += 1) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN_X + col * (halfW + 10);
      const y = pdf.y - row * 48;
      pdf.drawRect(x, y - 38, halfW, 38, C_SLATE_BG, C_BORDER, 0.7);
      pdf.drawRect(x, y - 38, 3.5, 38, C_NAVY);
      pdf.drawTextLine(metaCards[i].label, x + 10, y - 13, { font: "F2", size: 7.5, color: C_MUTED });
      pdf.drawTextLine(metaCards[i].value, x + 10, y - 28, { font: "F2", size: 10, color: C_NAVY_DARK });
    }
    pdf.y -= 108;

    pdf.drawRect(MARGIN_X, pdf.y - 34, CONTENT_W, 34, C_BLUE_BG, C_BLUE_BORDER, 0.7);
    pdf.drawTextLine("TARGET BANKING EXAMINATIONS", MARGIN_X + 10, pdf.y - 12, { font: "F2", size: 7.5, color: C_NAVY });
    pdf.drawTextLine(examsStr.slice(0, 88), MARGIN_X + 10, pdf.y - 25, { font: "F2", size: 9.4, color: C_TEXT });
    pdf.y -= 50;

    pdf.addSectionHeading("BOOKLET STRUCTURE");
    pdf.addParagraph("Section A  -  Exam-Standard Current Affairs Practice Questions", { font: "F2", size: 10, indent: 6, spaceAfter: 4 });
    pdf.addParagraph("Section B  -  Official Answer Key Grid", { font: "F2", size: 10, indent: 6, spaceAfter: 4 });
    pdf.addParagraph("Section C  -  Detailed Solutions, Elimination Guide & Source References", { font: "F2", size: 10, indent: 6, spaceAfter: 4 });
    pdf.addParagraph("Section D  -  High-Yield Current Affairs Revision Points", { font: "F2", size: 10, indent: 6, spaceAfter: 12 });

    pdf.addInstructionsBox(
      practiceSet.instructions ||
        "Attempt all questions in Section A under timed conditions before checking the Official Answer Key in Section B and Detailed Solutions in Section C.",
    );

    // Section A: Questions
    pdf.newPage();
    pdf.addSectionHeading("SECTION A — PRACTICE QUESTIONS", `${questions.length} exam-standard questions · Marking ${marksStr}`);
    renderQuestionsBlock(pdf, questions);

    // Section B: Answer Key
    pdf.newPage();
    renderAnswerKeyBlock(pdf, questions);

    // Section C: Detailed Solutions
    pdf.newPage();
    renderDetailedSolutionsBlock(pdf, questions);

    // Section D: Revision Points
    pdf.newPage();
    pdf.addSectionHeading("SECTION D — HIGH-YIELD REVISION POINTS", "Quick last-minute banking exam takeaways from this practice set");
    const uniqueFacts = [];
    const seenFact = new Set();
    for (const q of questions) {
      const facts = Array.isArray(q.important_facts) ? q.important_facts : [];
      for (const f of facts) {
        const clean = String(f || "").trim();
        if (clean && !seenFact.has(clean.toLowerCase())) {
          seenFact.add(clean.toLowerCase());
          uniqueFacts.push(clean);
        }
      }
      if (!facts.length && q.detailed_explanation) {
        uniqueFacts.push(`${q.category_name || "Current Affairs"}: ${q.detailed_explanation.slice(0, 180)}`);
      }
    }
    uniqueFacts.slice(0, 60).forEach((fact, idx) => {
      pdf.addParagraph(`${idx + 1}.  ${fact}`, { font: "F1", size: 9.6, indent: 6, spaceAfter: 5 });
    });
  } else {
    pdf.newPage();
    pdf.addBrandHeaderWithKpis({
      title,
      formatTitle: formatTitles[format],
      dateLabel,
      totalQuestions: questions.length,
      durationMinutes,
      marksStr,
    });

    if (format === "questions_only" || format === "answer_key") {
      pdf.addInstructionsBox(
        practiceSet.instructions ||
          "Read every question carefully and choose the single best option. Mark your answers before reviewing the key.",
      );
      pdf.addSectionHeading("PRACTICE QUESTIONS", `Total ${questions.length} questions · ${marksStr}`);
      renderQuestionsBlock(pdf, questions);
    }

    if (format === "answer_key") {
      renderAnswerKeyBlock(pdf, questions);
    }

    if (format === "detailed_solutions") {
      renderDetailedSolutionsBlock(pdf, questions);
    }
  }

  const buffer = pdf.finalize();
  const validation = validatePdfBuffer(buffer);
  if (!validation.valid) {
    throw new Error(`Generated PDF failed integrity check: ${validation.reason}`);
  }

  const slug =
    sanitizePdfText(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "hhk-ca-practice";
  const fileName = `${slug}-${format}.pdf`;

  return {
    buffer,
    fileName,
    fileSizeBytes: buffer.length,
    sha256Hash: crypto.createHash("sha256").update(buffer).digest("hex"),
    pageCount: validation.pageCount,
  };
}

export function validatePdfBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 100) {
    return { valid: false, reason: "Buffer is empty or too small." };
  }
  const head = buf.subarray(0, 8).toString("ascii");
  const tail = buf.subarray(Math.max(0, buf.length - 64)).toString("ascii");
  const text = buf.toString("latin1");
  if (!head.startsWith("%PDF-1.")) {
    return { valid: false, reason: "Missing PDF header signature." };
  }
  if (!text.includes("\nxref\n") || !text.includes("\ntrailer\n")) {
    return { valid: false, reason: "Missing xref or trailer structure." };
  }
  if (!tail.includes("%%EOF")) {
    return { valid: false, reason: "Missing %%EOF marker." };
  }
  const pageMatches = text.match(/\/Type\s+\/Page\b/g) || [];
  if (pageMatches.length < 1) {
    return { valid: false, reason: "No PDF pages found." };
  }
  return { valid: true, pageCount: pageMatches.length };
}