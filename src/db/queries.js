import { searchNearestNeighbors } from './vectorRepository';

export function vectorToBlobPlaceholder(vector) {
  return JSON.stringify(Array.from(vector));
}

export async function vectorSearch({ embedding, limit = 5 }) {
  const response = await searchNearestNeighbors({ embedding, limit });
  return response.results || [];
}
