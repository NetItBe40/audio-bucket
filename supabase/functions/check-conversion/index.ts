import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log(`Starting conversion check for ID: ${conversionId}`);
    console.log(`Target audio path: ${audioPath}`);

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
      console.error('AssemblyAI API error response:', error);
      throw new Error(`AssemblyAI API error: ${error}`);
    }

    const data = await response.json();
    console.log('AssemblyAI status:', data.status);

    if (data.status === 'error') {
      console.error('AssemblyAI processing error:', data.error);
      throw new Error(`AssemblyAI processing error: ${data.error}`);
    }

    if (data.status !== 'completed') {
      return new Response(
        JSON.stringify({ status: data.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Download the converted audio file
    console.log('Downloading converted audio from:', data.audio_url);
    const audioResponse = await fetch(data.audio_url);
    
    if (!audioResponse.ok) {
      console.error('Audio download failed:', audioResponse.statusText);
      throw new Error(`Failed to download converted audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log('Audio file downloaded, size:', audioBlob.size);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log('Uploading to audio-recordings:', audioPath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioPath, audioBlob, {
        contentType: 'audio/mpeg',
        upsert: true // Allow overwriting if file exists
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    console.log('Audio file uploaded successfully:', uploadData);

    // Clean up the temporary video file
    const tempFileName = audioPath.split('/').pop()?.replace('converted-', '') || '';
    if (tempFileName) {
      console.log('Cleaning up temporary file:', tempFileName);
      const { error: deleteError } = await supabase.storage
        .from('temp-uploads')
        .remove([tempFileName]);

      if (deleteError) {
        console.error('Failed to delete temporary file:', deleteError);
        // Don't throw here, as the conversion was successful
      }
    }

    // Get the public URL for the uploaded audio file
    const { data: { publicUrl } } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(audioPath);

    console.log('Audio file processing completed. Public URL:', publicUrl);

    return new Response(
      JSON.stringify({ 
        status: 'completed',
        audioPath,
        publicUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in check-conversion:', error);
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