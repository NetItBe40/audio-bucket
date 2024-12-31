import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { youtubeUrl } = await req.json();
    console.log('Processing YouTube URL:', youtubeUrl);

    if (!youtubeUrl) {
      throw new Error('URL YouTube manquante');
    }

    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeUrlPattern.test(youtubeUrl)) {
      throw new Error('URL YouTube invalide');
    }

    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    if (!RAPIDAPI_KEY) {
      throw new Error('Clé API RapidAPI non configurée');
    }

    // Extract video ID from URL
    const videoId = youtubeUrl.includes('v=') 
      ? youtubeUrl.split('v=')[1].split('&')[0]
      : youtubeUrl.split('/').pop();

    console.log('Calling RapidAPI YouTube MP3 API for video ID:', videoId);
    
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.error('RapidAPI error:', response.status, response.statusText);
      throw new Error(`Erreur de l'API RapidAPI: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Handle different API response statuses
    switch(data.status) {
      case 'ok':
        if (!data.link) {
          throw new Error('Lien de téléchargement manquant dans la réponse');
        }
        return new Response(
          JSON.stringify({
            downloadUrl: data.link,
            title: data.title,
            status: 'completed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      
      case 'processing':
        return new Response(
          JSON.stringify({
            status: 'processing',
            message: 'La conversion est en cours'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202 // Accepted
          }
        );
      
      case 'fail':
        throw new Error(data.msg || 'Échec de la conversion');
      
      default:
        throw new Error('Réponse inattendue de l\'API');
    }

  } catch (error) {
    console.error('Error in convert-youtube function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Une erreur est survenue lors de la conversion'
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