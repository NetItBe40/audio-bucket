import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversionId, audioPath } = await req.json();
    
    if (!conversionId || !audioPath) {
      throw new Error('Missing required parameters');
    }

    console.log(`Checking conversion status for: ${conversionId}`);

    // Check if the file exists and is accessible
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from('temp-uploads')
      .getPublicUrl(audioPath);

    console.log('Public URL:', publicUrl);

    // Verify file accessibility
    const fileCheck = await fetch(publicUrl);
    if (!fileCheck.ok) {
      throw new Error(`File is not accessible: ${fileCheck.statusText}`);
    }

    // Check conversion status with detailed error handling
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${conversionId}`,
      {
        headers: {
          'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AssemblyAI status check error:', errorText);
      throw new Error(`Failed to check conversion status: ${errorText}`);
    }

    const status = await response.json();
    console.log('Current status:', status);

    // Handle different AssemblyAI status states
    if (status.status === 'error') {
      throw new Error(`AssemblyAI processing error: ${status.error}`);
    }

    if (status.status === 'completed' && status.audio_url) {
      // Download the converted audio
      console.log('Downloading converted audio from:', status.audio_url);
      const audioResponse = await fetch(status.audio_url);
      
      if (!audioResponse.ok) {
        throw new Error('Failed to download converted audio');
      }

      const audioBlob = await audioResponse.blob();
      
      // Upload to audio-recordings
      console.log('Uploading to audio-recordings:', audioPath);
      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(audioPath, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Conversion and upload completed successfully');
      return new Response(
        JSON.stringify({ 
          status: 'completed', 
          audioPath,
          audioUrl: status.audio_url 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If still processing, return current status
    return new Response(
      JSON.stringify({ 
        status: status.status,
        progress: status.percentage_complete
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});