import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Download the file from temp-uploads
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('temp-uploads')
      .createSignedUrl(fileName, 3600);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw downloadError;
    }

    // Create a conversion record in the database
    const timestamp = Date.now();
    const audioFileName = `converted-${timestamp}-${originalName.replace(/\.[^/.]+$/, '')}.mp3`;
    
    // Download and upload to AssemblyAI
    const fileResponse = await fetch(fileData.signedUrl);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from temp-uploads');
    }
    const fileBuffer = await fileResponse.arrayBuffer();

    console.log('Starting AssemblyAI upload...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('AssemblyAI upload error:', errorText);
      throw new Error(`AssemblyAI upload failed: ${errorText}`);
    }

    const { upload_url } = await uploadResponse.json();
    console.log('File uploaded to AssemblyAI:', upload_url);

    // Start conversion process
    const conversionResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: 'fr',
      }),
    });

    if (!conversionResponse.ok) {
      throw new Error('Failed to start conversion');
    }

    const conversionData = await conversionResponse.json();
    console.log('Conversion started:', conversionData);

    // Return the conversion ID and target filename with CORS headers
    return new Response(
      JSON.stringify({ 
        conversionId: conversionData.id,
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