import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { filePath } = await req.json()

    // Download the video file from temp bucket
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('temp-uploads')
      .download(filePath)

    if (downloadError) throw downloadError

    // Convert video to audio using FFmpeg
    const ffmpeg = new FFmpeg()
    await ffmpeg.load()
    
    ffmpeg.FS('writeFile', 'input.mp4', await fileData.arrayBuffer())
    await ffmpeg.run('-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', 'output.mp3')
    const audioData = ffmpeg.FS('readFile', 'output.mp3')

    // Upload the converted audio file
    const audioPath = `converted-${Date.now()}.mp3`
    const { error: uploadError } = await supabaseClient
      .storage
      .from('audio-recordings')
      .upload(audioPath, audioData)

    if (uploadError) throw uploadError

    // Clean up temp file
    await supabaseClient
      .storage
      .from('temp-uploads')
      .remove([filePath])

    return new Response(
      JSON.stringify({ audioPath }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})