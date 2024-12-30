import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileName, originalName } = await req.json()
    
    if (!fileName || !originalName) {
      throw new Error('Missing required parameters')
    }

    console.log(`Processing file: ${fileName}, original name: ${originalName}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Download the file from temp-uploads
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('temp-uploads')
      .download(fileName)

    if (downloadError) {
      console.error('Download error:', downloadError)
      throw downloadError
    }

    // Convert to audio buffer using FFmpeg
    const ffmpeg = new Deno.Command("ffmpeg", {
      args: [
        "-i", "pipe:0",  // Read from stdin
        "-f", "mp3",     // Force MP3 format
        "-acodec", "libmp3lame",
        "-ab", "128k",
        "-ar", "44100",
        "-vn",          // No video
        "pipe:1"        // Output to stdout
      ],
      stdin: "piped",
      stdout: "piped",
    })

    const process = ffmpeg.spawn()
    
    // Write input file to FFmpeg's stdin
    const writer = process.stdin.getWriter()
    await writer.write(new Uint8Array(await fileData.arrayBuffer()))
    await writer.close()

    // Read the output
    const output = await process.output()
    
    if (output.code !== 0) {
      console.error('FFmpeg error:', new TextDecoder().decode(output.stderr))
      throw new Error('FFmpeg conversion failed')
    }

    // Upload to audio-recordings
    const timestamp = Date.now()
    const audioFileName = `converted-${timestamp}-${originalName.replace(/\.[^/.]+$/, '')}.mp3`
    
    const { error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioFileName, output.stdout, {
        contentType: 'audio/mpeg',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    // Clean up the original file from temp-uploads
    await supabase.storage
      .from('temp-uploads')
      .remove([fileName])

    return new Response(
      JSON.stringify({ audioPath: audioFileName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})