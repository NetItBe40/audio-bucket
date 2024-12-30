export class AudioConverter {
  private tempDir: string;

  constructor() {
    // Créer un dossier temporaire unique pour cette conversion
    this.tempDir = Deno.makeTempDirSync();
  }

  async convertToMp3(videoPath: string): Promise<Uint8Array> {
    const outputPath = `${this.tempDir}/output.mp3`;
    console.log(`Converting ${videoPath} to ${outputPath}`);

    try {
      // Utiliser la commande FFmpeg native
      const ffmpeg = new Deno.Command("ffmpeg", {
        args: [
          "-i", videoPath,
          "-vn",
          "-acodec", "libmp3lame",
          "-ab", "128k",
          "-ar", "44100",
          outputPath
        ],
      });

      const { code, stderr } = await ffmpeg.output();
      
      if (code !== 0) {
        throw new Error(`FFmpeg failed with error: ${new TextDecoder().decode(stderr)}`);
      }

      // Lire le fichier MP3 généré
      const audioData = await Deno.readFile(outputPath);
      
      return audioData;
    } catch (error) {
      console.error("Conversion error:", error);
      throw error;
    } finally {
      // Nettoyage
      try {
        await Deno.remove(this.tempDir, { recursive: true });
      } catch (error) {
        console.error("Error cleaning up temp directory:", error);
      }
    }
  }
}