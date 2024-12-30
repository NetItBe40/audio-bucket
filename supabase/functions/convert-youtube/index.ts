import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    // Get video details from YouTube API
    console.log('Fetching video details from YouTube API...');
    const videoDetails = await getVideoDetails(videoId, apiKey);
    const safeTitle = videoDetails.title.replace(/[^\w\s]/gi, '');
    console.log('Video title:', safeTitle);

    // Use youtube-to-mp315 API for conversion
    console.log('Starting conversion with youtube-to-mp315...');
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      throw new Error('RapidAPI key not configured');
    }

    const y2mateResponse = await fetch(`https://youtube-to-mp315.p.rapidapi.com/dl?id=${videoId}`, {
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      }
    });

    if (!y2mateResponse.ok) {
      console.error('RapidAPI error:', {
        status: y2mateResponse.status,
        statusText: y2mateResponse.statusText
      });
      const errorText = await y2mateResponse.text();
      console.error('RapidAPI error response:', errorText);
      throw new Error('Erreur lors de la requête à RapidAPI');
    }

    const y2mateData = await y2mateResponse.json();
    console.log('youtube-to-mp315 response:', JSON.stringify(y2mateData, null, 2));

    if (!y2mateData.link) {
      console.error('Invalid response from RapidAPI:', y2mateData);
      throw new Error('Réponse invalide de l\'API de conversion');
    }

    console.log('Conversion successful, returning download link');
    
    return new Response(
      JSON.stringify({
        downloadUrl: y2mateData.link,
        title: safeTitle
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