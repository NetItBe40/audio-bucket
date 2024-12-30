import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders, handleError, validateRequest, base64ToUint8Array } from "./utils.ts"
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
    
    const { videoChunk, fileName, chunkIndex, totalChunks, userId } = body
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileName}`)
    
    // Initialize storage
    const storage = new StorageManager()
    
    // Convert base64 chunk to binary
    const bytes = base64ToUint8Array(videoChunk)
    
    // Generate temp file name
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const tempFileName = `${userId}/temp-${timestamp}-${randomString}-chunk-${chunkIndex}`
    
    console.log(`Uploading chunk to temporary storage: ${tempFileName}`)
    await storage.uploadChunk(tempFileName, bytes)

    // Process final chunk
    if (chunkIndex === totalChunks - 1) {
      console.log('Processing final chunk, initiating conversion')
      
      try {
        // Initialize converter
        const converter = new AudioConverter()
        await converter.init()
        
        // Combine chunks
        console.log('Combining video chunks...')
        const chunks: Uint8Array[] = []
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = `${userId}/temp-${timestamp}-${randomString}-chunk-${i}`
          console.log(`Downloading chunk: ${chunkPath}`)
          chunks.push(await storage.downloadChunk(chunkPath))
        }

        // Combine chunks with memory optimization
        const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        const combinedVideo = new Uint8Array(totalSize)
        let offset = 0
        for (const chunk of chunks) {
          combinedVideo.set(chunk, offset)
          offset += chunk.length
        }

        console.log('Converting to audio...')
        const audioData = await converter.convertToMp3(combinedVideo)
        
        // Upload converted audio
        const audioFileName = `${userId}/converted-${timestamp}-${randomString}.mp3`
        await storage.uploadAudio(audioFileName, audioData)
        
        console.log('Cleaning up temporary chunks...')
        const tempChunks = Array.from({ length: totalChunks }, (_, i) => 
          `${userId}/temp-${timestamp}-${randomString}-chunk-${i}`
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
        return handleError(error)
      }
    }

    // Return success for intermediate chunks
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} processed successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return handleError(error)
  }
})