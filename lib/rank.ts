import type { kb_chunks } from "@prisma/client";

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
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

  const queryTerms = tokenize(query);
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
