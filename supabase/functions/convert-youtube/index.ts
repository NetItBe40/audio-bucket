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
  
  const url = `https://youtube-to-mp315.p.rapidapi.com/dl?id=${videoId}`;
  console.log('Making request to:', url);
  
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
    }
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    console.error('RapidAPI error:', {
      status: response.status,
      statusText: response.statusText
    });
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('API Response:', result);

  if (result.status === 'ok' && result.link) {
    return {
      downloadUrl: result.link,
      title: result.title || 'YouTube conversion'
    };
  } else {
    throw new Error(result.msg || 'Conversion failed');
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