import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ytdl from 'https://esm.sh/ytdl-core@4.11.5';

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

    // Valider l'URL YouTube
    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error('URL YouTube invalide');
    }

    console.log('Getting video info...');
    const info = await ytdl.getInfo(youtubeUrl);
    
    // Sélectionner le meilleur format audio
    const audioFormat = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio',
      filter: 'audioonly' 
    });

    if (!audioFormat || !audioFormat.url) {
      throw new Error('Aucun format audio disponible pour cette vidéo');
    }

    console.log('Audio format selected:', {
      quality: audioFormat.quality,
      container: audioFormat.container,
      audioCodec: audioFormat.audioCodec
    });

    return new Response(
      JSON.stringify({
        downloadUrl: audioFormat.url,
        title: info.videoDetails.title
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