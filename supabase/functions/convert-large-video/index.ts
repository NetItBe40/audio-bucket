import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { FFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.12.7'
import { fetchFile, toBlobURL } from 'https://esm.sh/@ffmpeg/util@0.12.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  try {
    console.log('Starting video conversion process...')
    const { videoChunk, fileName, chunkIndex, totalChunks, userId } = await req.json()
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileName}`)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Convert base64 chunk to Uint8Array
    const binaryString = atob(videoChunk)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Generate unique temp file name using timestamp and random string
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const tempFileName = `${userId}/temp-${timestamp}-${randomString}-chunk-${chunkIndex}`

    console.log(`Uploading chunk to temporary storage: ${tempFileName}`)

    // Upload chunk to temporary storage
    const { error: uploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(tempFileName, bytes, {
        upsert: false // Prevent overwriting existing files
      })

    if (uploadError) {
      console.error('Error uploading chunk:', uploadError)
      throw uploadError
    }

    // If this is the last chunk, combine all chunks and convert to MP3
    if (chunkIndex === totalChunks - 1) {
      console.log('Processing final chunk, initiating conversion')
      
      // Initialize FFmpeg with proper configuration
      const ffmpeg = new FFmpeg()
      console.log('Loading FFmpeg...')
      
      await ffmpeg.load({
        coreURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.wasm', 'application/wasm'),
        wasmURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.wasm', 'application/wasm'),
        workerURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.worker.js', 'application/javascript')
      })
      
      console.log('FFmpeg loaded successfully')

      // Combine all chunks into one video file
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

      // Combine chunks
      const combinedVideo = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      chunks.forEach(chunk => {
        combinedVideo.set(chunk, offset)
        offset += chunk.length
      })

      console.log('Combined video chunks, starting conversion...')

      // Convert to MP3
      await ffmpeg.writeFile('input.webm', combinedVideo)
      await ffmpeg.exec(['-i', 'input.webm', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'output.mp3'])
      const mp3Data = await ffmpeg.readFile('output.mp3')
      
      console.log('Conversion completed, uploading result...')
      
      // Generate unique audio file name
      const audioFileName = `${userId}/converted-${timestamp}-${randomString}.mp3`
      const { data: audioData, error: audioUploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(audioFileName, mp3Data, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false
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
    }

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
      JSON.stringify({ error: error.message }),
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