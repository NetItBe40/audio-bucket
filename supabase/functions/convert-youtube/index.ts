import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getVideoDetails(videoId: string, apiKey: string) {
  const response = await fetch(
    `https://youtube.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
  );
  const data = await response.json();
  
  if (!data.items?.length) {
    throw new Error('Vidéo non trouvée');
  }
  
  return {
    title: data.items[0].snippet.title,
    description: data.items[0].snippet.description
  };
}

function extractVideoId(url: string) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

async function startConversion(videoId: string, rapidApiKey: string) {
  console.log('Starting conversion for video ID:', videoId);
  
  const apiUrl = new URL('https://youtube-to-mp315.p.rapidapi.com/dl');
  apiUrl.searchParams.append('id', videoId);
  
  console.log('Making request to:', apiUrl.toString());
  
  try {
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.error('RapidAPI error:', {
        status: response.status,
        statusText: response.statusText
      });
      const errorText = await response.text();
      console.error('RapidAPI error response:', errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Conversion started:', JSON.stringify(data, null, 2));
    
    if (!data.id) {
      console.error('Invalid response from RapidAPI:', data);
      throw new Error('Réponse invalide de l\'API de conversion');
    }

    return data;
  } catch (error) {
    console.error('Error in startConversion:', error);
    throw new Error(`Erreur lors de la conversion: ${error.message}`);
  }
}

async function checkConversionStatus(conversionId: string, rapidApiKey: string) {
  console.log('Checking conversion status for ID:', conversionId);
  
  const response = await fetch(`https://youtube-to-mp315.p.rapidapi.com/status/${conversionId}`, {
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    console.error('Status check error:', {
      status: response.status,
      statusText: response.statusText
    });
    throw new Error('Erreur lors de la vérification du statut');
  }

  const data = await response.json();
  console.log('Status check response:', JSON.stringify(data, null, 2));
  return data;
}

async function waitForConversion(conversionId: string, rapidApiKey: string, maxAttempts = 12) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await checkConversionStatus(conversionId, rapidApiKey);
    
    if (status.status === 'AVAILABLE') {
      return status;
    }
    
    if (status.status === 'ERROR') {
      throw new Error('Erreur lors de la conversion');
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
    }
  }
  
  throw new Error('Délai de conversion dépassé');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting YouTube conversion process...');
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

    // Start the conversion
    const conversionData = await startConversion(videoId, rapidApiKey);
    console.log('Conversion started, ID:', conversionData.id);

    // Wait for conversion to complete
    const finalStatus = await waitForConversion(conversionData.id, rapidApiKey);
    console.log('Conversion completed:', finalStatus);

    if (!finalStatus.downloadUrl) {
      throw new Error('URL de téléchargement manquante dans la réponse');
    }

    return new Response(
      JSON.stringify({
        downloadUrl: finalStatus.downloadUrl,
        title: finalStatus.title || 'Sans titre'
      }),
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