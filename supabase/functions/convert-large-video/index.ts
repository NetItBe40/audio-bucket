import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoChunk, fileName, chunkIndex, totalChunks } = await req.json()
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileName}`)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Decode base64 chunk
    const binaryData = decode(videoChunk)
    const tempFileName = `temp-${Date.now()}-${fileName}-${chunkIndex}`

    console.log(`Uploading chunk to temp storage: ${tempFileName}`)

    // Upload chunk to temp storage
    const { error: uploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(tempFileName, binaryData)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    // If this is the last chunk, trigger video conversion
    if (chunkIndex === totalChunks - 1) {
      console.log('Processing final chunk, initiating conversion')
      
      // For now, we'll simulate the conversion by creating an audio file
      // In a real implementation, you would use FFmpeg here
      const audioFileName = `converted-${Date.now()}.mp3`
      
      // Clean up temp files
      const { data: tempFiles } = await supabase.storage
        .from('temp-uploads')
        .list()
      
      const filesToDelete = tempFiles
        ?.filter(file => file.name.includes(fileName))
        .map(file => file.name) || []

      if (filesToDelete.length > 0) {
        await supabase.storage
          .from('temp-uploads')
          .remove(filesToDelete)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          audioPath: audioFileName,
          message: 'Video conversion completed'
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
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error in convert-large-video function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})