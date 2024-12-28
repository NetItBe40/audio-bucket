import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const assemblyAIApiKey = Deno.env.get('ASSEMBLYAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { recordingId } = await req.json()

    // Get the recording file URL
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('file_path')
      .eq('id', recordingId)
      .single()

    if (recordingError || !recording) {
      throw new Error('Recording not found')
    }

    // Get a signed URL for the audio file
    const { data: { signedUrl }, error: signedUrlError } = await supabase
      .storage
      .from('audio-recordings')
      .createSignedUrl(recording.file_path, 3600)

    if (signedUrlError || !signedUrl) {
      throw new Error('Could not generate signed URL')
    }

    // Create transcription request with AssemblyAI
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIApiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: signedUrl,
        language_detection: true,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create transcription request')
    }

    const transcriptionData = await response.json()

    // Store the initial transcription record
    const { error: insertError } = await supabase
      .from('transcriptions')
      .insert({
        recording_id: recordingId,
        status: 'processing',
      })

    if (insertError) {
      throw new Error('Failed to create transcription record')
    }

    // Start polling for transcription status
    const pollStatus = async () => {
      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptionData.id}`,
        {
          headers: {
            'Authorization': assemblyAIApiKey!,
          },
        }
      )

      if (!statusResponse.ok) {
        throw new Error('Failed to get transcription status')
      }

      const statusData = await statusResponse.json()

      // Update transcription record with status and text if completed
      if (statusData.status === 'completed') {
        await supabase
          .from('transcriptions')
          .update({
            status: 'completed',
            text: statusData.text,
            language: statusData.language_code,
          })
          .eq('recording_id', recordingId)
      } else if (statusData.status === 'error') {
        await supabase
          .from('transcriptions')
          .update({
            status: 'error',
          })
          .eq('recording_id', recordingId)
      }

      return statusData.status
    }

    // Initial poll after 5 seconds
    setTimeout(pollStatus, 5000)

    return new Response(
      JSON.stringify({ message: 'Transcription started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in transcribe function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})