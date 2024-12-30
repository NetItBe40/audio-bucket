import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractVideoId(url: string) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

async function startConversion(videoId: string, rapidApiKey: string) {
  console.log('Starting conversion for video ID:', videoId);
  
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const apiUrl = `https://youtube-to-mp315.p.rapidapi.com/download?url=${encodeURIComponent(youtubeUrl)}`;
  console.log('Making request to:', apiUrl);
  
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
    }
  };

  try {
    console.log('Request options:', JSON.stringify(options, null, 2));
    const response = await fetch(apiUrl, options);
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('RapidAPI error:', {
        status: response.status,
        statusText: response.statusText
      });
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('API Response:', result);

    if (result.status === 'ERROR') {
      throw new Error(result.message || 'Conversion failed');
    }

    // Si nous avons une URL de téléchargement directe, on la retourne
    if (result.downloadUrl) {
      return {
        downloadUrl: result.downloadUrl,
        title: result.title || 'YouTube conversion'
      };
    }

    // Sinon, on attend que la conversion soit terminée
    let conversionStatus = result.status || 'CONVERTING';
    let attempts = 0;
    const maxAttempts = 30; // 30 secondes maximum
    
    while (conversionStatus === 'CONVERTING' && attempts < maxAttempts) {
      const statusResponse = await fetch(
        `https://youtube-to-mp315.p.rapidapi.com/status/${result.id}`, 
        {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com',
          }
        }
      );
      
      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }
      
      const statusResult = await statusResponse.json();
      console.log('Status check result:', statusResult);
      
      if (statusResult.status === 'AVAILABLE') {
        return {
          downloadUrl: statusResult.downloadUrl,
          title: statusResult.title || 'YouTube conversion'
        };
      } else if (statusResult.status === 'ERROR') {
        throw new Error('Conversion failed');
      }
      
      conversionStatus = statusResult.status;
      attempts++;
      
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Conversion timeout');
    }

    return {
      downloadUrl: result.downloadUrl,
      title: result.title || 'YouTube conversion'
    };
  } catch (error) {
    console.error('Error during API call:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { youtubeUrl } = await req.json();
    console.log('Received YouTube URL:', youtubeUrl);

    if (!youtubeUrl) {
      throw new Error('URL YouTube manquante');
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      console.error('Invalid YouTube URL:', youtubeUrl);
      throw new Error('URL YouTube invalide');
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      throw new Error('RapidAPI key not configured');
    }

    const conversionData = await startConversion(videoId, rapidApiKey);
    
    return new Response(
      JSON.stringify(conversionData),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in convert-youtube function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Une erreur est survenue'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});