import { readObjectBoxDocuments } from './objectBoxStore';

function cosineSimilarity(left, right) {
  const size = Math.max(left?.length || 0, right?.length || 0);
  if (size === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < size; index += 1) {
    const leftValue = Number(left?.[index] || 0);
    const rightValue = Number(right?.[index] || 0);
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
}

function tokenizeQuery(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const QUERY_SYNONYMS = {
  hot: ['heat', 'heatstroke', 'sunstroke', 'overheat', 'overheating'],
  heat: ['hot', 'heatstroke', 'sunstroke', 'overheat', 'overheating'],
  heatstroke: ['heat', 'hot', 'sunstroke', 'overheating'],
  thirsty: ['dehydration', 'hydrate', 'water'],
  cold: ['hypothermia', 'freeze', 'freezing'],
};

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    const normalized = token.replace(/\s+/g, '');
    const synonyms = QUERY_SYNONYMS[normalized] || [];

    expanded.add(normalized);
    for (const synonym of synonyms) {
      expanded.add(synonym);
    }
  }

  return Array.from(expanded);
}

function textScore(doc, queryTokens) {
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleLower = (doc.title || '').toLowerCase();
  const contentLower = (doc.content || '').toLowerCase();
  let hits = 0;

  for (const token of queryTokens) {
    if (titleLower.includes(token)) {
      hits += 3;
    } else if (contentLower.includes(token)) {
      hits += 1;
    }
  }

  return hits / (queryTokens.length * 3);
}

function formatResults(rows) {
  return rows.map((doc) => ({
    id: String(doc.id),
    title: doc.title,
    content: `${doc.content}\n\n[score=${doc.score.toFixed(4)}] [category=${doc.category || 'general'}]`,
  }));
}

export async function searchNearestNeighbors({ embedding, limit = 5, query = '' }) {
  try {
    const docs = await readObjectBoxDocuments();

    if (!Array.isArray(docs) || docs.length === 0) {
      return {
        mode: 'basic',
        reason: 'No local documents were found.',
        results: [],
      };
    }

    const firstEmbeddedDoc = docs.find(
      (doc) => doc._hasRealEmbedding && Array.isArray(doc.embedding) && doc.embedding.length > 0,
    );
    const queryEmbeddingLength = Number(embedding?.length || 0);
    const corpusEmbeddingLength = Number(firstEmbeddedDoc?.embedding?.length || 0);
    const useVectorSearch = Boolean(
      firstEmbeddedDoc &&
        queryEmbeddingLength > 0 &&
        corpusEmbeddingLength > 0 &&
        queryEmbeddingLength === corpusEmbeddingLength,
    );

    if (!useVectorSearch) {
      // If corpus/query vectors are unavailable or incompatible, use keyword text search.
      const queryTokens = expandQueryTokens(tokenizeQuery(query));
      const results = docs
        .map((doc) => ({ ...doc, score: textScore(doc, queryTokens) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
      const reason = firstEmbeddedDoc
        ? `Using basic search: query embedding length (${queryEmbeddingLength}) does not match corpus embeddings (${corpusEmbeddingLength}).`
        : 'Using basic search: no precomputed embeddings found in the local corpus.';

      return {
        mode: 'basic',
        reason,
        results: formatResults(results),
      };
    }

    const queryTokens = expandQueryTokens(tokenizeQuery(query));
    const vectorWeight = embedding?.source === 'onnx' ? 0.85 : 0.4;
    const lexicalWeight = 1 - vectorWeight;
    const vectorResults = docs
      .map((doc) => {
        const semanticScore = cosineSimilarity(embedding, doc.embedding);
        const lexicalScore = textScore(doc, queryTokens);

        return {
          ...doc,
          score: semanticScore * vectorWeight + lexicalScore * lexicalWeight,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      mode: 'vector',
      reason: `Using embeddings + keyword ranking (dim ${queryEmbeddingLength}).`,
      results: formatResults(vectorResults),
    };
  } catch (error) {
    return {
      mode: 'basic',
      reason: `Using basic search due to error: ${error?.message || 'Unknown error'}`,
      results: [
        {
          id: 'fallback-1',
          title: 'ObjectBox Query Placeholder',
          content: `ObjectBox store is not ready in this environment. Received embedding size: ${embedding?.length || 0}. Error: ${error?.message || 'Unknown error'}`,
        },
      ],
    };
  }
}
