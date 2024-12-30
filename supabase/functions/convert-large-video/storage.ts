import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export class StorageManager {
  private supabase;
  private tempDir: string;
  
  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    this.tempDir = Deno.makeTempDirSync();
  }

  async downloadChunk(path: string): Promise<string> {
    console.log(`Downloading chunk: ${path}`);
    const { data, error } = await this.supabase.storage
      .from('temp-uploads')
      .download(path);
      
    if (error) throw error;

    const chunkPath = `${this.tempDir}/${path.split('/').pop()}`;
    await Deno.writeFile(chunkPath, new Uint8Array(await data.arrayBuffer()));
    return chunkPath;
  }

  async combineChunks(chunkPaths: string[]): Promise<string> {
    const outputPath = `${this.tempDir}/combined.webm`;
    const output = await Deno.open(outputPath, { write: true, create: true });

    for (const chunkPath of chunkPaths) {
      const chunkData = await Deno.readFile(chunkPath);
      await output.write(chunkData);
    }

    output.close();
    return outputPath;
  }

  async uploadAudio(fileName: string, audioData: Uint8Array): Promise<void> {
    console.log(`Uploading converted audio: ${fileName}`);
    const { error } = await this.supabase.storage
      .from('audio-recordings')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (error) throw error;
  }

  async cleanup(paths: string[]): Promise<void> {
    console.log('Cleaning up temporary files...');
    // Supprimer les chunks du stockage Supabase
    await this.supabase.storage
      .from('temp-uploads')
      .remove(paths);

    // Supprimer le dossier temporaire local
    try {
      await Deno.remove(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("Error cleaning up temp directory:", error);
    }
  }
}