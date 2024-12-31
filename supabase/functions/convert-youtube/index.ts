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

    // Validate YouTube URL format
    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeUrlPattern.test(youtubeUrl)) {
      throw new Error('URL YouTube invalide');
    }

    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
    if (!RAPIDAPI_KEY) {
      throw new Error('Clé API RapidAPI non configurée');
    }

    console.log('Calling RapidAPI YouTube MP3 API...');
    
    const response = await fetch('https://youtube-mp36.p.rapidapi.com/dl', {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
      },
      params: new URLSearchParams({
        id: youtubeUrl.split('v=')[1] || youtubeUrl.split('/').pop() || ''
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('RapidAPI error:', errorData);
      throw new Error(`Erreur de l'API RapidAPI: ${response.status}`);
    }

    const data = await response.json();
    console.log('Conversion response:', data);

    if (data.status === 'fail') {
      throw new Error(data.msg || 'Échec de la conversion');
    }

    if (!data.link) {
      throw new Error('Lien de téléchargement non disponible');
    }

    return new Response(
      JSON.stringify({
        downloadUrl: data.link,
        title: data.title
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