import { FFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.12.7'
import { fetchFile } from 'https://esm.sh/@ffmpeg/util@0.12.1'

export class AudioConverter {
  private ffmpeg: FFmpeg
  
  constructor() {
    this.ffmpeg = new FFmpeg({
      log: true,
      logger: ({ message }) => console.log(message),
      progress: ({ progress, time }) => console.log('Progress:', progress, 'Time:', time),
    })
  }
  
  async init() {
    await this.ffmpeg.load({
      coreURL: await fetch('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js').then(r => r.text()),
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
      workerURL: undefined, // Disable worker
    })
  }
  
  async convertToMp3(videoData: Uint8Array): Promise<Uint8Array> {
    try {
      console.log('Starting video conversion...')
      
      // Write input file directly
      await this.ffmpeg.writeFile('input.webm', videoData)
      console.log('Input file written successfully')
      
      // Run FFmpeg command to convert to MP3
      console.log('Running FFmpeg conversion command...')
      await this.ffmpeg.exec([
        '-i', 'input.webm',
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', '2',
        '-y',
        'output.mp3'
      ])
      console.log('FFmpeg conversion completed')
      
      // Read the output file
      console.log('Reading output file...')
      const data = await this.ffmpeg.readFile('output.mp3')
      console.log('Output file read successfully')
      
      return new Uint8Array(data)
    } catch (error) {
      console.error('Error in convertToMp3:', error)
      throw error
    }
  }
}