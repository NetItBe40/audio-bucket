import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, handleError, validateRequest } from "./utils.ts"
import { StorageManager } from "./storage.ts"
import { AudioConverter } from "./converter.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting video conversion process...')
    
    // Parse and validate request
    const body = await req.json()
    validateRequest(body)
    
    const { fileName, totalChunks, originalName } = body
    console.log(`Processing video conversion for ${originalName} with ${totalChunks} chunks`)
    
    // Initialize storage
    const storage = new StorageManager()
    
    try {
      // Combine chunks
      console.log('Combining video chunks...')
      const chunks: Uint8Array[] = []
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `temp/${fileName}-chunk-${i}`
        console.log(`Downloading chunk: ${chunkPath}`)
        chunks.push(await storage.downloadChunk(chunkPath))
      }

      // Combine chunks
      const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combinedVideo = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of chunks) {
        combinedVideo.set(chunk, offset)
        offset += chunk.length
      }

      // Convert to audio
      console.log('Converting to audio...')
      const converter = new AudioConverter()
      await converter.init()
      const audioData = await converter.convertToMp3(combinedVideo)
      
      // Upload converted audio
      const audioFileName = `converted-${fileName}.mp3`
      await storage.uploadAudio(audioFileName, audioData)
      
      // Clean up temporary chunks
      console.log('Cleaning up temporary chunks...')
      const tempChunks = Array.from({ length: totalChunks }, (_, i) => 
        `temp/${fileName}-chunk-${i}`
      )
      await storage.cleanup(tempChunks)

      return new Response(
        JSON.stringify({ 
          success: true,
          audioPath: audioFileName
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Conversion error:', error)
      return handleError(error)
    }
  } catch (error) {
    console.error('Request error:', error)
    return handleError(error)
  }
})