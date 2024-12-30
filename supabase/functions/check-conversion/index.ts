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

    // Check conversion status
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${conversionId}`,
      {
        headers: {
          'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to check conversion status');
    }

    const status = await response.json();
    console.log('Current status:', status.status);

    if (status.status === 'completed' && status.audio_url) {
      // Download the converted audio
      const audioResponse = await fetch(status.audio_url);
      if (!audioResponse.ok) {
        throw new Error('Failed to download converted audio');
      }

      const audioBlob = await audioResponse.blob();
      
      // Upload to audio-recordings
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(audioPath, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      return new Response(
        JSON.stringify({ status: 'completed', audioPath }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ status: status.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});