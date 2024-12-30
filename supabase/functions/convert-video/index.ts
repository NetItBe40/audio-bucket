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
      .createSignedUrl(fileName, 3600)

    if (downloadError) {
      console.error('Download error:', downloadError)
      throw downloadError
    }

    // Envoyer le fichier à AssemblyAI pour conversion
    const response = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fileData.signedUrl,
        audio_start_from: 0,
        audio_end_at: null,
        chunk_size: 5242880,
        chunk_overlap: 0,
        format_type: "mp3",
        audio_description: originalName,
      }),
    })

    if (!response.ok) {
      throw new Error(`AssemblyAI API error: ${await response.text()}`)
    }

    const conversionData = await response.json()
    
    // Télécharger le fichier MP3 converti
    const audioResponse = await fetch(conversionData.audio_url)
    if (!audioResponse.ok) {
      throw new Error('Failed to download converted audio')
    }

    const audioBlob = await audioResponse.blob()
    
    // Upload to audio-recordings
    const timestamp = Date.now()
    const audioFileName = `converted-${timestamp}-${originalName.replace(/\.[^/.]+$/, '')}.mp3`
    
    const { error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioFileName, audioBlob, {
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