import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function uploadToAssemblyAI(file: File) {
  console.log('Starting AssemblyAI upload...')
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
    },
    body: await file.arrayBuffer()
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    console.error('AssemblyAI upload error:', errorText)
    throw new Error(`AssemblyAI upload failed: ${errorText}`)
  }

  const { upload_url } = await uploadResponse.json()
  console.log('File uploaded to AssemblyAI:', upload_url)
  return upload_url
}

async function requestConversion(audioUrl: string, fileName: string) {
  console.log('Requesting conversion for:', fileName)
  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      audio_start_from: 0,
      audio_end_at: null,
      format_type: "mp3",
      audio_description: fileName,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('AssemblyAI conversion request error:', errorText)
    throw new Error(`AssemblyAI conversion request failed: ${errorText}`)
  }

  const data = await response.json()
  console.log('Conversion requested:', data)
  return data
}

async function checkConversionStatus(transcriptId: string) {
  console.log('Checking conversion status for:', transcriptId)
  const response = await fetch(
    `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
    {
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('AssemblyAI status check error:', errorText)
    throw new Error(`AssemblyAI status check failed: ${errorText}`)
  }

  const status = await response.json()
  console.log('Current status:', status.status)
  return status
}

serve(async (req) => {
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

    // Download the file content
    const fileResponse = await fetch(fileData.signedUrl)
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from temp-uploads')
    }
    const fileBlob = await fileResponse.blob()
    const file = new File([fileBlob], originalName, { type: fileBlob.type })

    // Upload to AssemblyAI
    const uploadUrl = await uploadToAssemblyAI(file)

    // Request conversion
    const conversionData = await requestConversion(uploadUrl, originalName)
    
    // Poll for completion
    let audioUrl = null
    let attempts = 0
    const maxAttempts = 30 // 30 * 2 seconds = 1 minute max wait
    
    while (!audioUrl && attempts < maxAttempts) {
      const status = await checkConversionStatus(conversionData.id)
      
      if (status.status === 'completed' && status.audio_url) {
        audioUrl = status.audio_url
      } else if (status.status === 'error') {
        throw new Error('Conversion failed: ' + status.error)
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