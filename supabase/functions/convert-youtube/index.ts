import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
if (!rapidApiKey) {
  throw new Error('RAPIDAPI_KEY is not set');
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { youtubeUrl } = await req.json();
    console.log('Processing YouTube URL:', youtubeUrl);

    // Initiate conversion
    const convertUrl = `https://youtube-to-mp315.p.rapidapi.com/download?url=${encodeURIComponent(youtubeUrl)}&format=mp3&quality=0`;
    const options = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      }
    };

    const response = await fetch(convertUrl, options);
    const result = await response.json();
    console.log('Initial conversion result:', result);

    if (result.status === 'CONVERTING' && result.id) {
      let attempts = 0;
      const maxAttempts = 12; // 2 minutes maximum

      while (attempts < maxAttempts) {
        await wait(10000); // 10 seconds between checks
        
        const statusUrl = `https://youtube-to-mp315.p.rapidapi.com/status/${result.id}`;
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: options.headers
        });
        
        const statusResult = await statusResponse.json();
        console.log(`Status check attempt ${attempts + 1}:`, statusResult);

        if (statusResult.status === 'AVAILABLE') {
          // Download the file
          console.log('Downloading file from:', statusResult.downloadUrl);
          const fileResponse = await fetch(statusResult.downloadUrl);
          const fileBlob = await fileResponse.blob();
          
          // Return both the file data and metadata
          return new Response(
            JSON.stringify({
              downloadUrl: statusResult.downloadUrl,
              title: statusResult.title,
              fileData: await fileBlob.arrayBuffer(),
              contentType: fileResponse.headers.get('content-type') || 'audio/mpeg'
            }),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json'
              } 
            }
          );
        }

        if (statusResult.status === 'EXPIRED' || statusResult.status === 'CONVERSION_ERROR') {
          throw new Error(`Conversion failed: ${statusResult.status}`);
        }

        attempts++;
      }

      throw new Error('Conversion timeout');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});