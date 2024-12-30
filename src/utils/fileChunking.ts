export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB en bytes
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000; // 1 seconde

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

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const blobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
};