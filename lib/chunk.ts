import { parse } from "node-html-parser";

// Convert raw HTML to clean text
export function htmlToText(html: string): string {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true },
  });

  root
    .querySelectorAll("script,style,meta,nav,footer,header")
    .forEach((el) => el.remove());

  const blocks = new Set([
    "p",
    "li",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "section",
    "article",
    "div",
  ]);

  root.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();

    if (tag && blocks.has(tag)) {
      el.insertAdjacentHTML("beforebegin", "\n");
      el.insertAdjacentHTML("afterend", "\n");
    }
  });

  let text = root.text.replace(/\u00A0/g, ""); // removes every non-breaking space
  text = text.replace(/[ \t]+\n/g, "\n"); // collapses any run of spaces or tabs that sits right before a newline down to the newline alone
  text = text.replace(/\n{3,}/g, "\n\n"); // shortens any blockof three or more consecutive lines to exactly 2, limits vertical gaps
  text = text.replace(/[ \t]{2,}/g, " "); // replaces stretches of two or more spaces/tabs inside a line with a single regular space
  return text.trim();
}

const intoParagraphs = (text: string): string[] => {
  return text
    .split(/\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);
};

// break paragraphs into sentences whenever it sees punctuatuin that usually ends a sentence/followed by a whitespace/followed by start of what it looks like a new sentence
const intoSentences = (paragraph: string): string[] => {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((s) => s.trim())
    .filter(Boolean);
};

// Pack sentences into chunks ~maxChars with overlap, avoid tiny fragments.
export function splitIntoChunks(
  text: string,
  maxChars = 700,
  opts?: { minChars?: number; overlapChars?: number }
): string[] {
  const minChars = opts?.minChars ?? Math.floor(maxChars * 0.5);
  const overlapChars = opts?.overlapChars ?? Math.floor(maxChars * 0.15);

  const paragraphs = intoParagraphs(text);
  const sentences = paragraphs.flatMap(intoSentences);

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
      // very long sentence—emit alone
      chunks.push(sentence);
      continue;
    }

    flush();

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

  // merge last tiny chunk if needed
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (last.length < minChars) {
      chunks[chunks.length - 2] = `${chunks[chunks.length - 2]} ${last}`.trim();
      chunks.pop();
    }
  }

  return chunks;
}

// Naive tokenizer + TF
export const termFreq = (text: string): Record<string, number> => {
  const stop = new Set([
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

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !stop.has(t));

  const tf: Record<string, number> = {};

  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

  return tf;
};
