export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export const createChunks = (file: File): Blob[] => {
  const chunks: Blob[] = [];
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    chunks.push(file.slice(start, end));
    start = end;
  }

  return chunks;
};

export const getChunkProgress = (chunkIndex: number, totalChunks: number): number => {
  return Math.round(((chunkIndex + 1) / totalChunks) * 100);
};