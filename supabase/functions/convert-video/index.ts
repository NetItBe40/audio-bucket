import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase_supabase-js@2'

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

    console.log('Got signed URL:', fileData.signedUrl)

    // First, upload the file to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
      },
      body: await fetch(fileData.signedUrl).then(res => res.blob())
    })

    if (!uploadResponse.ok) {
      throw new Error(`AssemblyAI upload error: ${await uploadResponse.text()}`)
    }

    const { upload_url } = await uploadResponse.json()
    console.log('File uploaded to AssemblyAI:', upload_url)

    // Then request the conversion
    const conversionResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        audio_start_from: 0,
        audio_end_at: null,
        format_type: "mp3",
        audio_description: originalName,
      }),
    })

    if (!conversionResponse.ok) {
      throw new Error(`AssemblyAI conversion error: ${await conversionResponse.text()}`)
    }

    const conversionData = await conversionResponse.json()
    console.log('Conversion initiated:', conversionData)
    
    // Poll for completion and get the audio URL
    let audioUrl = null
    let attempts = 0
    const maxAttempts = 30 // 30 * 2 seconds = 1 minute max wait
    
    while (!audioUrl && attempts < maxAttempts) {
      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${conversionData.id}`,
        {
          headers: {
            'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
          },
        }
      )
      
      if (!statusResponse.ok) {
        throw new Error(`AssemblyAI status check error: ${await statusResponse.text()}`)
      }
      
      const status = await statusResponse.json()
      console.log('Conversion status:', status.status)
      
      if (status.status === 'completed' && status.audio_url) {
        audioUrl = status.audio_url
      } else if (status.status === 'error') {
        throw new Error('Conversion failed')
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        attempts++
      }
    }
    
    if (!audioUrl) {
      throw new Error('Conversion timeout')
    }

    // Download the converted audio
    const audioResponse = await fetch(audioUrl)
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