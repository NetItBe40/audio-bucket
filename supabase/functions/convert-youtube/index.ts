import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
if (!rapidApiKey) {
  throw new Error('RAPIDAPI_KEY is not set');
}

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
    
    const url = `https://youtube-to-mp315.p.rapidapi.com/download?url=${encodeURIComponent(youtubeUrl)}&format=mp3&quality=0`;
    
    const options = {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      }
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      console.log('Résultat de la conversion:', result);

      if (result.status === 'CONVERTING') {
        console.log('Conversion en cours...');
        console.log('ID de conversion:', result.id);
        return result;
      } else if (result.status === 'AVAILABLE') {
        console.log('Conversion terminée !');
        console.log('Lien de téléchargement:', result.downloadUrl);
        console.log('Titre:', result.title);
        return result;
      } else {
        console.log('Statut:', result.status);
        console.log('Détails:', result);
      }

      return result;
    } catch (error) {
      console.error('Erreur lors de la conversion:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in convert-youtube function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});