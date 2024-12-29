import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoChunk, fileName, chunkIndex, totalChunks } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Decode base64 chunk
    const binaryData = decode(videoChunk)
    const tempFileName = `chunk-${fileName}-${chunkIndex}`

    // Upload chunk to temp storage
    const { error: uploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(tempFileName, binaryData)

    if (uploadError) throw uploadError

    // If this is the last chunk, combine and convert
    if (chunkIndex === totalChunks - 1) {
      // Combine chunks and convert to audio (implementation depends on your FFmpeg setup)
      const audioFileName = `converted-${Date.now()}.mp3`
      
      // Here you would implement the FFmpeg conversion
      // For now, we'll just return the audio file name
      return new Response(
        JSON.stringify({ audioPath: audioFileName }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Chunk uploaded successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})