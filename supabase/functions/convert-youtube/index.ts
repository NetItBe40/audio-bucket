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

    const SELLSY_API_KEY = Deno.env.get('SELLSY_API_KEY');
    if (!SELLSY_API_KEY) {
      throw new Error('Clé API Sellsy non configurée');
    }

    console.log('Calling Sellsy API for conversion...');
    
    const response = await fetch('https://api.sellsy.com/v2/youtube/convert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SELLSY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: youtubeUrl,
        format: 'mp3'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Sellsy API error:', errorData);
      throw new Error(`Erreur de l'API Sellsy: ${response.status}`);
    }

    const data = await response.json();
    console.log('Conversion successful:', data);

    return new Response(
      JSON.stringify({
        downloadUrl: data.downloadUrl,
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