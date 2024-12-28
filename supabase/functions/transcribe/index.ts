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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { recordingId, speakerDetection, entityDetection } = await req.json()
    console.log('Starting transcription for recording:', recordingId, 
      'with speaker detection:', speakerDetection,
      'and entity detection:', entityDetection
    )

    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('file_path')
      .eq('id', recordingId)
      .single()

    if (recordingError || !recording) {
      console.error('Error fetching recording:', recordingError)
      throw new Error('Recording not found')
    }

    console.log('Found recording with file path:', recording.file_path)

    const { data: { signedUrl }, error: signedUrlError } = await supabase
      .storage
      .from('audio-recordings')
      .createSignedUrl(recording.file_path, 3600)

    if (signedUrlError || !signedUrl) {
      console.error('Error generating signed URL:', signedUrlError)
      throw new Error('Could not generate signed URL')
    }

    console.log('Generated signed URL successfully')

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
        speaker_labels: speakerDetection,
        entity_detection: entityDetection,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AssemblyAI API error:', errorText)
      throw new Error('Failed to create transcription request')
    }

    const transcriptionData = await response.json()
    console.log('Created AssemblyAI transcription:', transcriptionData)

    // Store the initial transcription record
    const { error: insertError } = await supabase
      .from('transcriptions')
      .insert({
        recording_id: recordingId,
        status: 'processing',
        speaker_detection: speakerDetection,
        entity_detection: entityDetection,
      })

    if (insertError) {
      console.error('Error creating transcription record:', insertError)
      throw new Error('Failed to create transcription record')
    }

    console.log('Created transcription record successfully')

    // Start polling for transcription status
    const pollStatus = async () => {
      try {
        console.log('Polling transcription status...')
        const statusResponse = await fetch(
          `https://api.assemblyai.com/v2/transcript/${transcriptionData.id}`,
          {
            headers: {
              'Authorization': assemblyAIApiKey!,
            },
          }
        )

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text()
          console.error('Error polling status:', errorText)
          throw new Error('Failed to get transcription status')
        }

        const statusData = await statusResponse.json()
        console.log('Received status:', statusData.status)

        if (statusData.status === 'completed') {
          const { error: updateError } = await supabase
            .from('transcriptions')
            .update({
              status: 'completed',
              text: statusData.text,
              language: statusData.language_code,
              speaker_labels: speakerDetection ? statusData.utterances : null,
              entities: entityDetection ? statusData.entities : null,
            })
            .eq('recording_id', recordingId)

          if (updateError) {
            console.error('Error updating transcription:', updateError)
          } else {
            console.log('Transcription completed successfully')
          }
        } else if (statusData.status === 'error') {
          const { error: updateError } = await supabase
            .from('transcriptions')
            .update({
              status: 'error',
            })
            .eq('recording_id', recordingId)

          if (updateError) {
            console.error('Error updating transcription status:', updateError)
          }
        } else {
          // Schedule next poll in 5 seconds if still processing
          setTimeout(pollStatus, 5000)
        }
      } catch (error) {
        console.error('Error in polling:', error)
        await supabase
          .from('transcriptions')
          .update({
            status: 'error',
          })
          .eq('recording_id', recordingId)
      }
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