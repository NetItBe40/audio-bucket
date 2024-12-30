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

    // For now, we'll just move the file to audio-recordings
    // In a real implementation, you would send this to a conversion service
    const timestamp = Date.now()
    const audioFileName = `converted-${timestamp}-${originalName}`
    
    const { error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioFileName, fileData, {
        contentType: 'video/mp4', // Keep original content type for now
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