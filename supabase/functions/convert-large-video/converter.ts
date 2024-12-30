import { FFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.12.7'
import { fetchFile } from 'https://esm.sh/@ffmpeg/util@0.12.1'

export class AudioConverter {
  private ffmpeg: FFmpeg
  
  constructor() {
    this.ffmpeg = new FFmpeg()
  }
  
  async init() {
    await this.ffmpeg.load()
  }
  
  async convertToMp3(videoData: Uint8Array): Promise<Uint8Array> {
    // Create a temporary Blob and URL for the video data
    const blob = new Blob([videoData])
    const videoUrl = URL.createObjectURL(blob)
    
    try {
      // Write input file using fetchFile
      const inputFile = await fetchFile(videoUrl)
      await this.ffmpeg.writeFile('input.webm', inputFile)
      
      // Run FFmpeg command to convert to MP3
      await this.ffmpeg.exec([
        '-i', 'input.webm',
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', '2',
        '-y',
        'output.mp3'
      ])
      
      // Read the output file
      const data = await this.ffmpeg.readFile('output.mp3')
      
      return new Uint8Array(data)
    } finally {
      // Clean up the temporary URL
      URL.revokeObjectURL(videoUrl)
    }
  }
}