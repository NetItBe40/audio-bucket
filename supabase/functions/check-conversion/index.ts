import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      const error = await response.text();
      throw new Error(`AssemblyAI API error: ${error}`);
    }

    const data = await response.json();
    console.log('Conversion status:', data.status);

    if (data.status === 'error') {
      throw new Error(`AssemblyAI processing error: ${data.error}`);
    }

    if (data.status !== 'completed') {
      return new Response(
        JSON.stringify({ status: data.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Download the converted audio file
    console.log('Downloading converted audio...');
    const audioResponse = await fetch(data.audio_url);
    
    if (!audioResponse.ok) {
      throw new Error('Failed to download converted audio');
    }

    const audioBlob = await audioResponse.blob();
    
    // Upload to audio-recordings
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log('Uploading to audio-recordings:', audioPath);
    const { error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioPath, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    // Clean up the temporary video file
    console.log('Cleaning up temporary file...');
    const { error: deleteError } = await supabase.storage
      .from('temp-uploads')
      .remove([audioPath.replace('converted-', '')]);

    if (deleteError) {
      console.error('Failed to delete temporary file:', deleteError);
      // Don't throw here, as the conversion was successful
    }

    return new Response(
      JSON.stringify({ 
        status: 'completed',
        audioPath
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        status: 500,
      },
    );
  }
});