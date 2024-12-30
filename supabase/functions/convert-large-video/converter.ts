import { FFmpeg } from "https://esm.sh/@ffmpeg/ffmpeg@0.10.1"

export class AudioConverter {
  private ffmpeg: FFmpeg;
  
  constructor() {
    this.ffmpeg = new FFmpeg()
  }
  
  async init() {
    await this.ffmpeg.load()
  }
  
  async convertToMp3(videoData: Uint8Array): Promise<Uint8Array> {
    await this.ffmpeg.writeFile('input.webm', videoData)
    
    await this.ffmpeg.exec([
      '-i', 'input.webm',
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      '-y',
      'output.mp3'
    ])
    
    return await this.ffmpeg.readFile('output.mp3') as Uint8Array
  }
}