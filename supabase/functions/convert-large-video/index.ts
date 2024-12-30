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
      // Download and combine chunks
      console.log('Processing video chunks...')
      const chunkPaths: string[] = []
      const tempChunks: string[] = []

      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `temp/${fileName}-chunk-${i}`
        tempChunks.push(chunkPath)
        const localPath = await storage.downloadChunk(chunkPath)
        chunkPaths.push(localPath)
      }

      // Combine chunks into a single video file
      console.log('Combining video chunks...')
      const combinedVideoPath = await storage.combineChunks(chunkPaths)

      // Convert to audio
      console.log('Converting to audio...')
      const converter = new AudioConverter()
      const audioData = await converter.convertToMp3(combinedVideoPath)
      
      // Upload converted audio
      const audioFileName = `converted-${fileName}.mp3`
      await storage.uploadAudio(audioFileName, audioData)
      
      // Clean up temporary chunks
      console.log('Cleaning up temporary chunks...')
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