/**
 * Minimal PDF text extractor (no dependencies). Inflates FlateDecode content streams, reads
 * text-positioning (Tm/Td) and show-text (Tj/TJ) operators, and rebuilds lines by y-position,
 * joining cells on the same line with a tab. Good enough for digitally generated invoices
 * (the Stage 1 bridge); scanned PDFs need the Stage 2 OCR provider.
 */
import { inflateSync } from "node:zlib";

const WIN_ANSI_EXTRA: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x84: "„", 0x85: "…", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”",
  0x95: "•", 0x96: "–", 0x97: "—", 0x99: "™", 0xa0: " ",
};

function decodeByte(b: number): string {
  if (WIN_ANSI_EXTRA[b]) return WIN_ANSI_EXTRA[b];
  return String.fromCharCode(b);
}

function decodeHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 2) out += decodeByte(parseInt(clean.slice(i, i + 2).padEnd(2, "0"), 16));
  return out;
}

function decodeLiteral(lit: string): string {
  let out = "";
  for (let i = 0; i < lit.length; i++) {
    const c = lit[i];
    if (c !== "\\") {
      out += decodeByte(c.charCodeAt(0) & 0xff);
      continue;
    }
    const n = lit[++i];
    if (n === undefined) break;
    if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(lit[i + 1] ?? "")) oct += lit[++i];
      out += decodeByte(parseInt(oct, 8));
    } else out += ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[n] ?? n;
  }
  return out;
}

/** Raw bytes of every stream in the file, inflated when FlateDecode. */
function extractStreams(buf: Buffer): Buffer[] {
  const out: Buffer[] = [];
  const latin = buf.toString("latin1");
  const re = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin))) {
    const dict = m[1];
    const start = m.index + m[0].length;
    const lenMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let end = lenMatch ? start + parseInt(lenMatch[1], 10) : latin.indexOf("endstream", start);
    if (end < start || end > buf.length) end = latin.indexOf("endstream", start);
    const raw = buf.subarray(start, end);
    if (/\/Subtype\s*\/Image/.test(dict)) continue;
    if (/FlateDecode/.test(dict)) {
      try {
        out.push(inflateSync(raw));
      } catch {
        /* skip undecodable stream */
      }
    } else out.push(raw);
    re.lastIndex = end;
  }
  return out;
}

interface Run {
  x: number;
  y: number;
  text: string;
  page: number;
}

function runsFromContent(content: string, page: number): Run[] {
  const runs: Run[] = [];
  let x = 0;
  let y = 0;
  // Tokenise strings, arrays and operators in order.
  const tokenRe = /(\((?:\\.|[^\\)])*\))|(<[0-9A-Fa-f\s]*>)|(\[)|(\])|(-?\d*\.?\d+)|([A-Za-z'"*]+)|(\/[^\s/<>[\]()]+)/g;
  const stack: (number | string)[] = [];
  let arrayParts: string[] | null = null;
  let t: RegExpExecArray | null;
  while ((t = tokenRe.exec(content))) {
    const [, lit, hex, open, close, num, op] = t;
    if (lit !== undefined) {
      const s = decodeLiteral(lit.slice(1, -1));
      if (arrayParts) arrayParts.push(s);
      else stack.push(s);
    } else if (hex !== undefined) {
      const s = decodeHex(hex.slice(1, -1));
      if (arrayParts) arrayParts.push(s);
      else stack.push(s);
    } else if (open) arrayParts = [];
    else if (close) {
      stack.push((arrayParts ?? []).join(""));
      arrayParts = null;
    } else if (num !== undefined) {
      if (!arrayParts) stack.push(parseFloat(num));
    } else if (op) {
      const nums = stack.filter((v): v is number => typeof v === "number");
      switch (op) {
        case "Tm":
          if (nums.length >= 6) {
            x = nums[nums.length - 2];
            y = nums[nums.length - 1];
          }
          break;
        case "Td":
        case "TD":
          if (nums.length >= 2) {
            x += nums[nums.length - 2];
            y += nums[nums.length - 1];
          }
          break;
        case "BT":
          x = 0;
          y = 0;
          break;
        case "Tj":
        case "TJ":
        case "'":
        case '"': {
          const s = [...stack].reverse().find((v): v is string => typeof v === "string");
          if (s && s.trim()) runs.push({ x, y, text: s, page });
          break;
        }
      }
      stack.length = 0;
    }
  }
  return runs;
}

export interface PdfTextResult {
  text: string;
  lines: string[];
  pageCount: number;
  runCount: number;
}

export function extractPdfText(bytes: Uint8Array): PdfTextResult {
  const buf = Buffer.from(bytes);
  const header = buf.subarray(0, 5).toString("latin1");
  if (header !== "%PDF-") return { text: "", lines: [], pageCount: 0, runCount: 0 };
  const pageRe = /\/Type\s*\/Page(?!s)/g;
  let pageCount = (buf.toString("latin1").match(pageRe) ?? []).length;
  const runs: Run[] = [];
  extractStreams(buf).forEach((s, i) => {
    const content = s.toString("latin1");
    // Page dictionaries may live inside compressed object streams (PDF 1.5+).
    pageCount += (content.match(pageRe) ?? []).length;
    if (/\bBT\b/.test(content) && /T[jJ]/.test(content)) runs.push(...runsFromContent(content, i));
  });
  if (!pageCount && runs.length) pageCount = 1;
  // Group by page stream then y (descending = top to bottom), x ascending.
  const groups = new Map<string, Run[]>();
  for (const r of runs) {
    const key = `${r.page}:${Math.round(r.y)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const lines = [...groups.entries()]
    .sort((a, b) => {
      const [pa, ya] = a[0].split(":").map(Number);
      const [pb, yb] = b[0].split(":").map(Number);
      return pa - pb || yb - ya;
    })
    .map(([, rs]) =>
      rs
        .sort((a, b) => a.x - b.x)
        .map((r) => r.text.trim())
        .join("\t"),
    );
  return { text: lines.join("\n"), lines, pageCount, runCount: runs.length };
}
