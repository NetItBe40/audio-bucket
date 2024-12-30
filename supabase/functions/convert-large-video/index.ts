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
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const { videoChunk, fileName, chunkIndex, totalChunks, userId } = body
    
    if (!videoChunk || !fileName || chunkIndex === undefined || !totalChunks || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
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
      return new Response(
        JSON.stringify({ error: 'Invalid video chunk data' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const tempFileName = `${userId}/temp-${timestamp}-${randomString}-chunk-${chunkIndex}`
    
    console.log(`Uploading chunk to temporary storage: ${tempFileName}`)

    // Upload chunk with error handling and retry logic
    let uploadAttempts = 0;
    const maxUploadAttempts = 3;
    
    while (uploadAttempts < maxUploadAttempts) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('temp-uploads')
          .upload(tempFileName, bytes, {
            contentType: 'application/octet-stream',
            upsert: true
          })

        if (uploadError) throw uploadError
        break; // Success, exit loop
      } catch (error) {
        uploadAttempts++;
        console.error(`Upload attempt ${uploadAttempts} failed:`, error)
        
        if (uploadAttempts === maxUploadAttempts) {
          return new Response(
            JSON.stringify({ error: `Failed to upload chunk after ${maxUploadAttempts} attempts` }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, uploadAttempts) * 1000));
      }
    }

    // Process final chunk
    if (chunkIndex === totalChunks - 1) {
      console.log('Processing final chunk, initiating conversion')
      
      try {
        const ffmpeg = new FFmpeg()
        console.log('Loading FFmpeg...')
        
        await ffmpeg.load()
        console.log('FFmpeg loaded successfully')

        // Combine chunks with improved memory handling
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

        // Combine video chunks with memory optimization
        const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
        const combinedVideo = new Uint8Array(totalSize)
        let offset = 0
        for (const chunk of chunks) {
          combinedVideo.set(chunk, offset)
          offset += chunk.length
          // Free up memory
          chunk = null
        }

        console.log('Combined video chunks, starting conversion...')

        // Convert to audio with optimized settings
        await ffmpeg.writeFile('input.webm', combinedVideo)
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-vn',
          '-acodec', 'libmp3lame',
          '-q:a', '2',
          '-y', // Overwrite output file if it exists
          'output.mp3'
        ])
        const mp3Data = await ffmpeg.readFile('output.mp3')
        
        console.log('Conversion completed, uploading result...')
        
        // Upload converted audio with retry logic
        const audioFileName = `${userId}/converted-${timestamp}-${randomString}.mp3`
        let audioUploadAttempts = 0;
        
        while (audioUploadAttempts < maxUploadAttempts) {
          try {
            const { error: audioUploadError } = await supabase.storage
              .from('audio-recordings')
              .upload(audioFileName, mp3Data, {
                contentType: 'audio/mpeg',
                upsert: true
              })

            if (audioUploadError) throw audioUploadError
            break; // Success, exit loop
          } catch (error) {
            audioUploadAttempts++;
            console.error(`Audio upload attempt ${audioUploadAttempts} failed:`, error)
            
            if (audioUploadAttempts === maxUploadAttempts) {
              throw new Error(`Failed to upload converted audio after ${maxUploadAttempts} attempts`)
            }
            
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, audioUploadAttempts) * 1000));
          }
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
      } catch (error) {
        console.error('Error in final chunk processing:', error)
        return new Response(
          JSON.stringify({ 
            error: 'Error processing final chunk',
            details: error.message
          }),
          { 
            status: 500,
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json'
            } 
          }
        )
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
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})