import type { kb_chunks } from "@prisma/client";

export function normalizeToken(t: string): string {
  t = t.replace(/’s$|'s$/i, "");
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("s") && t.length > 3) return t.slice(0, -1);

  return t;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken);
}

const SNIPPET_STOP = new Set([
  "what",
  "when",
  "where",
  "which",
  "who",
  "how",
  "why",
  "can",
  "do",
  "does",
  "is",
  "are",
  "your",
  "you",
  "me",
  "please",
  "tell",
  "about",
  "any",
  "give",
  "need",
  "info",
  "information",
  "kind",
  "type",
]);

const QUERY_STOP = new Set([
  ...SNIPPET_STOP,
  "are",
  "am",
  "is",
  "was",
  "were",
  "be",
  "been",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "might",
  "may",
  "please",
  "tell",
  "about",
  "give",
  "need",
  "info",
  "information",
  "kind",
  "type",
  "any",
  "me",
  "us",
  "do",
  "does",
  "did",
]);

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();

  for (const tok of tokens) {
    expanded.add(tok);

    if (tok.endsWith("ing") && tok.length > 4) {
      expanded.add(tok.slice(0, -3));
    }
    if (tok.endsWith("ed") && tok.length > 4) {
      expanded.add(tok.slice(0, -2));
    }
    if (tok.endsWith("ly") && tok.length > 4) {
      expanded.add(tok.slice(0, -2));
    }
    if (tok.endsWith("es") && tok.length > 4) {
      expanded.add(tok.slice(0, -2));
    }
    if (tok.endsWith("s") && tok.length > 3) {
      expanded.add(tok.slice(0, -1));
    }

    if (tok === "opening" || tok === "opened") expanded.add("open");
    if (tok === "closing" || tok === "closed") expanded.add("close");
    if (tok === "hours") expanded.add("hour");
    if (tok === "services" || tok === "service") {
      expanded.add("service");
      expanded.add("services");
    }
  }

  return Array.from(expanded);
}

export function extractSnippet(
  text: string,
  query: string,
  maxLen = 200
): string {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[\p{L}(0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text;
  }

  const rawTokens = tokenize(query).filter(
    (tok) => tok.length > 1 && !SNIPPET_STOP.has(tok)
  );

  const expandedQueryTokens = expandTokens(rawTokens);

  const queryHasTimeIntent = expandedQueryTokens.some((tok) =>
    ["hour", "hours", "time", "open", "opening", "close", "closing"].includes(tok)
  );

  const queryTokens = new Set(expandedQueryTokens);

  let bestIdx = 0;
  let bestScore = -Infinity;

  const loweredSentenceCache = new Map<string, string>();

  const scoreSentence = (sentence: string, index: number): number => {
    const tokens = tokenize(sentence);
    if (!tokens.length) return -1;

    let overlap = 0;
    const uniques = new Set<string>();
    for (const tok of tokens) {
      if (queryTokens.has(tok)) {
        overlap += 1;
        uniques.add(tok);
      }
    }

    if (overlap === 0) return -tokens.length * 0.01;

    const density = overlap / tokens.length;
    let score = uniques.size * 2 + density;

    const lowered = loweredSentenceCache.get(sentence) ?? sentence.toLowerCase();
    loweredSentenceCache.set(sentence, lowered);

    if (queryHasTimeIntent) {
      if (/\b(open|opening|close|closing|hour|hours)\b/.test(lowered)) {
        score += 0.75;
      }
      if (/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/.test(lowered)) {
        score += 1;
      }
      if (/\b\d{1,2}(?:\s?[–-]\s?\d{1,2})\b/.test(lowered)) {
        score += 0.8;
      }
    }

    if (/\b(policy|policies|deposit|cancellation)\b/.test(lowered)) {
      score -= 0.4;
    }

    // Slight bias towards earlier sentences when scores tie closely
    score -= index * 0.01;

    return score;
  };

  sentences.forEach((sentence, idx) => {
    const score = scoreSentence(sentence, idx);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  let snippet = sentences[bestIdx];

  if (snippet.length < maxLen * 0.6 && bestIdx + 1 < sentences.length) {
    const next = sentences[bestIdx + 1];
    const combined = `${snippet} ${next}`.trim();
    if (combined.length <= maxLen) {
      snippet = combined;
    }
  }

  if (snippet.length > maxLen) {
    snippet = `${snippet.slice(0, maxLen).trim()}…`;
  }

  return snippet;
}

type KnowledgeChunk = Pick<kb_chunks, "id" | "text" | "meta">;

export type RankedChunk = {
  id: string;
  text: string;
  score: number;
};

export function buildInverseDocumentFrequencies(chunks: KnowledgeChunk[]) {
  const documentFrequencies = new Map<string, number>();
  const totalDocuments = chunks.length;

  for (const chunk of chunks) {
    // Use precomputed TF terms if available, else tokenize the text
    const terms = (chunk.meta as any)?.tf
      ? Object.keys((chunk.meta as any).tf)
      : Array.from(new Set(tokenize(chunk.text)));

    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      documentFrequencies.set(term, (documentFrequencies.get(term) ?? 0) + 1);
    }
  }

  const idfScores = new Map<string, number>();
  for (const [term, df] of documentFrequencies) {
    idfScores.set(term, Math.log((totalDocuments + 1) / (df + 1)) + 1);
  }

  return { idfScores, totalDocuments };
}

/**
 * Score chunks against a query using TF-IDF, return topK results.
 */
export function rankChunksByTfIdf(
  chunks: KnowledgeChunk[],
  query: string,
  topK = 3
): RankedChunk[] {
  if (!chunks.length) return [];

  const baseTokens = tokenize(query).filter((tok) => !QUERY_STOP.has(tok));
  const queryTerms = expandTokens(baseTokens);
  if (!queryTerms.length) return [];

  const { idfScores } = buildInverseDocumentFrequencies(chunks);

  const rankedResults: RankedChunk[] = [];

  for (const chunk of chunks) {
    const termFrequencies: Record<string, number> =
      (chunk.meta as any)?.tf ?? Object.create(null);

    let chunkScore = 0;
    for (const queryTerm of queryTerms) {
      const tf = termFrequencies[queryTerm] ?? 0;
      const idf = idfScores.get(queryTerm) ?? 1;
      chunkScore += tf * idf * idf; // stronger weight for rare terms
    }

    if (chunkScore > 0) {
      rankedResults.push({
        id: chunk.id,
        text: chunk.text,
        score: chunkScore,
      });
    }
  }

  rankedResults.sort((a, b) => b.score - a.score);
  return rankedResults.slice(0, topK);
}
