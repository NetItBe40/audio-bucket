import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { FFmpeg } from "https://esm.sh/@ffmpeg/ffmpeg@0.10.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting video conversion process...')
    
    // Parse request body with error handling
    let body;
    try {
      body = await req.json()
    } catch (error) {
      console.error('Error parsing request body:', error)
      throw new Error('Invalid request body')
    }
    
    const { videoChunk, fileName, chunkIndex, totalChunks, userId } = body
    
    if (!videoChunk || !fileName || chunkIndex === undefined || !totalChunks || !userId) {
      throw new Error('Missing required parameters')
    }
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileName}`)
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Convert base64 chunk to Uint8Array with error handling
    let bytes;
    try {
      const binaryString = atob(videoChunk)
      bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
    } catch (error) {
      console.error('Error converting base64 to binary:', error)
      throw new Error('Invalid video chunk data')
    }

    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const tempFileName = `${userId}/temp-${timestamp}-${randomString}-chunk-${chunkIndex}`

    console.log(`Uploading chunk to temporary storage: ${tempFileName}`)

    // Upload chunk with error handling
    try {
      const { error: uploadError } = await supabase.storage
        .from('temp-uploads')
        .upload(tempFileName, bytes, {
          contentType: 'application/octet-stream',
          upsert: true
        })

      if (uploadError) throw uploadError
    } catch (error) {
      console.error('Error uploading chunk:', error)
      throw new Error(`Failed to upload chunk: ${error.message}`)
    }

    // Process final chunk
    if (chunkIndex === totalChunks - 1) {
      console.log('Processing final chunk, initiating conversion')
      
      try {
        const ffmpeg = new FFmpeg()
        console.log('Loading FFmpeg...')
        
        await ffmpeg.load()
        console.log('FFmpeg loaded successfully')

        // Combine chunks
        console.log('Combining video chunks...')
        const chunks = []
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = `${userId}/temp-${timestamp}-${randomString}-chunk-${i}`
          console.log(`Downloading chunk: ${chunkPath}`)
          
          const { data: chunkData, error: chunkError } = await supabase.storage
            .from('temp-uploads')
            .download(chunkPath)
          
          if (chunkError) {
            console.error('Error downloading chunk:', chunkError)
            throw chunkError
          }
          
          chunks.push(new Uint8Array(await chunkData.arrayBuffer()))
        }

        // Combine video chunks
        const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        const combinedVideo = new Uint8Array(totalSize)
        let offset = 0
        for (const chunk of chunks) {
          combinedVideo.set(chunk, offset)
          offset += chunk.length
        }

        console.log('Combined video chunks, starting conversion...')

        // Convert to audio
        await ffmpeg.writeFile('input.webm', combinedVideo)
        await ffmpeg.exec(['-i', 'input.webm', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'output.mp3'])
        const mp3Data = await ffmpeg.readFile('output.mp3')
        
        console.log('Conversion completed, uploading result...')
        
        // Upload converted audio
        const audioFileName = `${userId}/converted-${timestamp}-${randomString}.mp3`
        const { error: audioUploadError } = await supabase.storage
          .from('audio-recordings')
          .upload(audioFileName, mp3Data, {
            contentType: 'audio/mpeg',
            upsert: true
          })

        if (audioUploadError) {
          console.error('Error uploading converted audio:', audioUploadError)
          throw audioUploadError
        }

        console.log('Successfully uploaded converted audio:', audioFileName)

        // Clean up temporary chunks
        console.log('Cleaning up temporary chunks...')
        for (let i = 0; i < totalChunks; i++) {
          const tempChunkName = `${userId}/temp-${timestamp}-${randomString}-chunk-${i}`
          await supabase.storage
            .from('temp-uploads')
            .remove([tempChunkName])
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            audioPath: audioFileName
          }),
          { 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json'
            } 
          }
        )
      } catch (ffmpegError) {
        console.error('FFmpeg error:', ffmpegError)
        throw new Error(`FFmpeg error: ${ffmpegError.message}`)
      }
    }

    // Return success for intermediate chunks
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} processed successfully`
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})