import { createFFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.9.7';

export class AudioConverter {
  private ffmpeg;
  
  constructor() {
    this.ffmpeg = createFFmpeg({
      log: true,
      logger: ({ message }) => console.log(message),
      corePath: 'https://unpkg.com/@ffmpeg/core@0.8.5/dist/ffmpeg-core.js'
    });
  }
  
  async init() {
    try {
      if (!this.ffmpeg.isLoaded()) {
        await this.ffmpeg.load();
      }
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      throw error;
    }
  }
  
  async convertToMp3(videoData: Uint8Array): Promise<Uint8Array> {
    try {
      console.log('Starting video conversion...');
      
      // Write input file to memory
      console.log('Writing input file to memory...');
      this.ffmpeg.FS('writeFile', 'input.webm', videoData);
      
      // Run FFmpeg command
      console.log('Running FFmpeg conversion command...');
      await this.ffmpeg.run(
        '-i', 'input.webm',
        '-vn',
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '44100',
        'output.mp3'
      );
      
      // Read the output file from memory
      console.log('Reading output file from memory...');
      const data = this.ffmpeg.FS('readFile', 'output.mp3');
      
      // Clean up
      console.log('Cleaning up temporary files...');
      this.ffmpeg.FS('unlink', 'input.webm');
      this.ffmpeg.FS('unlink', 'output.mp3');
      
      console.log('Conversion completed successfully');
      return data;
    } catch (error) {
      console.error('Error during conversion:', error);
      throw error;
    }
  }
}