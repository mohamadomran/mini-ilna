import { parse } from "node-html-parser";
import { normalizeToken } from "./rank";

// Convert raw HTML to clean text
export function htmlToText(html: string): string {
  // 1) kill doctype early so it never lands in text
  const cleaned = html.replace(/^<!doctype[^>]*>/i, "");

  const root = parse(cleaned, {
    comment: false,
    blockTextElements: { script: true, style: true },
  });

  root
    .querySelectorAll("script,style,meta,nav,footer,header")
    .forEach((el) => el.remove());

  // prefer structured/inner text if available
  // @ts-ignore
  let text: string = root.structuredText ?? root.innerText ?? root.text ?? "";

  // normalize entities/dashes (helps tokenize times, ranges)
  text = text.replace(/&nbsp;/gi, " ").replace(/&(ndash|mdash);/gi, "-");

  // whitespace cleanup
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const intoParagraphs = (text: string): string[] =>
  text
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);

// Split on sentence enders, keep Unicode initials
const intoSentences = (paragraph: string): string[] =>
  paragraph
    .split(/(?<=[.!?])\s+(?=[\p{L}(0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);

// Pack sentences into ~maxChars with overlap
export function splitIntoChunks(
  text: string,
  maxChars = 700,
  opts?: { minChars?: number; overlapChars?: number }
): string[] {
  const minChars = opts?.minChars ?? Math.floor(maxChars * 0.5);
  const overlapChars = opts?.overlapChars ?? Math.floor(maxChars * 0.15);

  const sentences = intoParagraphs(text).flatMap(intoSentences);
  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;

  const flush = () => {
    if (!buf.length) return;
    const chunk = buf.join(" ").trim();
    if (chunk) chunks.push(chunk);
    buf = [];
    len = 0;
  };

  for (const sentence of sentences) {
    const sentenceLen = sentence.length + (buf.length ? 1 : 0);
    if (len + sentenceLen <= maxChars) {
      buf.push(sentence);
      len += sentenceLen;
      continue;
    }
    if (len < minChars && !buf.length) {
      chunks.push(sentence);
      continue;
    }

    flush();

    // Overlap tail from previous chunk
    if (overlapChars > 0 && chunks.length > 0) {
      const prev = chunks[chunks.length - 1];
      const tail = prev.slice(Math.max(0, prev.length - overlapChars));
      buf.push(tail);
      len = tail.length;
    }

    buf.push(sentence);
    len += sentence.length + (buf.length > 1 ? 1 : 0);
  }

  flush();

  // Merge last tiny fragment
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (last.length < minChars) {
      chunks[chunks.length - 2] = `${chunks[chunks.length - 2]} ${last}`.trim();
      chunks.pop();
    }
  }

  return chunks;
}

// Shared tokenizer (Unicode letters + numbers)
const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

// Naive stoplist
const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "to",
  "for",
  "on",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "with",
  "by",
  "from",
  "that",
  "this",
  "it",
  "as",
  "we",
  "you",
  "your",
  "our",
  "their",
  "they",
  "i",
]);

export const termFreq = (text: string): Record<string, number> => {
  const tf: Record<string, number> = Object.create(null);
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken);

  for (const tok of tokens) {
    if (/^\d{4,}$/.test(tok)) continue;
    if (STOP.has(tok)) continue;
    tf[tok] = (tf[tok] ?? 0) + 1;
  }
  return tf;
};
