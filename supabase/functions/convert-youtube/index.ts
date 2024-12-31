import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { youtubeUrl } = await req.json();
    console.log('Processing YouTube URL:', youtubeUrl);

    if (!youtubeUrl) {
      throw new Error('URL YouTube manquante');
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      throw new Error('RapidAPI key not configured');
    }

    // Appel à l'API RapidAPI pour la conversion
    console.log('Making request to RapidAPI...');
    const response = await fetch('https://youtube-to-mp315.p.rapidapi.com/download', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      },
      body: JSON.stringify({ url: youtubeUrl })
    });

    if (!response.ok) {
      console.error('RapidAPI error response:', {
        status: response.status,
        statusText: response.statusText
      });
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('RapidAPI response:', result);

    if (result.status === 'ERROR') {
      throw new Error(result.message || 'Conversion failed');
    }

    // Si nous avons une URL de téléchargement directe
    if (result.downloadUrl) {
      return new Response(
        JSON.stringify({
          downloadUrl: result.downloadUrl,
          title: result.title || 'YouTube conversion'
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Attendre que la conversion soit terminée si nécessaire
    let conversionStatus = result.status || 'CONVERTING';
    let attempts = 0;
    const maxAttempts = 30; // 30 secondes maximum

    while (conversionStatus === 'CONVERTING' && attempts < maxAttempts) {
      console.log(`Checking conversion status (attempt ${attempts + 1}/${maxAttempts})...`);
      
      const statusResponse = await fetch(
        `https://youtube-to-mp315.p.rapidapi.com/status/${result.id}`,
        {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
          }
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusResult = await statusResponse.json();
      console.log('Status check result:', statusResult);

      if (statusResult.status === 'AVAILABLE') {
        return new Response(
          JSON.stringify({
            downloadUrl: statusResult.downloadUrl,
            title: statusResult.title || 'YouTube conversion'
          }),
          { 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      } else if (statusResult.status === 'ERROR') {
        throw new Error('Conversion failed');
      }

      conversionStatus = statusResult.status;
      attempts++;

      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Conversion timeout');

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