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
    
    // Validate YouTube URL
    if (!youtubeUrl || !youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
      throw new Error('Invalid YouTube URL');
    }
    
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
    if (!response.ok) {
      console.error('RapidAPI initial response error:', response.status, await response.text());
      throw new Error(`RapidAPI returned status ${response.status}`);
    }

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
        
        if (!statusResponse.ok) {
          console.error('Status check failed:', statusResponse.status, await statusResponse.text());
          throw new Error(`Status check failed with status ${statusResponse.status}`);
        }

        const statusResult = await statusResponse.json();
        console.log(`Status check attempt ${attempts + 1}:`, statusResult);

        if (statusResult.status === 'AVAILABLE') {
          // Download the file
          console.log('Downloading file from:', statusResult.downloadUrl);
          const fileResponse = await fetch(statusResult.downloadUrl);
          
          if (!fileResponse.ok) {
            console.error('File download failed:', fileResponse.status, await fileResponse.text());
            throw new Error('Failed to download the converted file');
          }

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
          console.error('Conversion failed with status:', statusResult.status);
          throw new Error(`Conversion failed: ${statusResult.status}`);
        }

        attempts++;
      }

      throw new Error('Conversion timeout: process took too long');
    } else {
      console.error('Unexpected initial status:', result.status);
      throw new Error(`Unexpected conversion status: ${result.status}`);
    }

  } catch (error) {
    console.error('Error details:', error);
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