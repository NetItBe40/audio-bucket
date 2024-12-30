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
    const { fileName } = await req.json();
    
    if (!fileName) {
      throw new Error('Missing fileName parameter');
    }

    console.log(`Starting conversion for file: ${fileName}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('temp-uploads')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for file');
    }

    const publicUrl = urlData.publicUrl;
    console.log('File public URL:', publicUrl);

    // Verify file accessibility
    const fileCheck = await fetch(publicUrl);
    if (!fileCheck.ok) {
      throw new Error(`File is not accessible (${fileCheck.status}): ${fileCheck.statusText}`);
    }

    // Start transcription with AssemblyAI using the public URL
    console.log('Starting AssemblyAI transcription...');
    const transcriptionResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: publicUrl,
        audio_start_from: 0,
        audio_end_at: null,
      }),
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text();
      throw new Error(`AssemblyAI API error: ${error}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    console.log('Transcription started:', transcriptionData);

    // Create the target audio filename
    const timestamp = Date.now();
    const audioFileName = `converted-${timestamp}-${fileName.replace(/\.[^/.]+$/, '')}.mp3`;

    return new Response(
      JSON.stringify({ 
        conversionId: transcriptionData.id,
        audioPath: audioFileName,
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    );
  }
});