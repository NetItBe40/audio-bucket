import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getPublicUrl(supabase: any, filePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from('temp-uploads')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  return data.publicUrl;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, originalName } = await req.json();
    
    if (!fileName || !originalName) {
      throw new Error('Missing required parameters');
    }

    console.log(`Starting async processing for: ${fileName}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get the file URL from temp-uploads
    console.log('Getting file from temp-uploads...');
    const publicUrl = await getPublicUrl(supabase, fileName);
    console.log('File public URL:', publicUrl);

    // 2. Start transcription with AssemblyAI using the public URL
    console.log('Starting AssemblyAI transcription...');
    const transcriptionResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: publicUrl,
        language_code: 'fr',
      }),
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text();
      console.error('AssemblyAI transcription error:', error);
      throw new Error(`Failed to start transcription: ${error}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    console.log('Transcription started:', transcriptionData);

    // Create the target audio filename
    const timestamp = Date.now();
    const audioFileName = `converted-${timestamp}-${originalName.replace(/\.[^/.]+$/, '')}.mp3`;

    // Return the transcription ID and target filename
    return new Response(
      JSON.stringify({ 
        conversionId: transcriptionData.id,
        audioPath: audioFileName
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    );
  }
});