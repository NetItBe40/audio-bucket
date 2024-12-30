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
    console.log('Processing YouTube URL:', youtubeUrl);
    
    // Using the correct RapidAPI endpoint for YouTube to MP3 conversion
    const url = 'https://youtube-to-mp315.p.rapidapi.com/download';
    
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      },
      params: {
        url: youtubeUrl,
        format: 'mp3',
        quality: '320'
      }
    };

    try {
      // Construct the URL with query parameters
      const queryParams = new URLSearchParams({
        url: youtubeUrl,
        format: 'mp3',
        quality: '320'
      });
      const fullUrl = `${url}?${queryParams.toString()}`;
      
      console.log('Making request to RapidAPI:', fullUrl);
      const response = await fetch(fullUrl, options);
      const result = await response.json();
      
      console.log('API Response:', result);

      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            isRateLimit: true,
            details: "Monthly quota exceeded. Please try again next month or contact support."
          }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${JSON.stringify(result)}`);
      }

      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error('RapidAPI request failed:', error);
      return new Response(
        JSON.stringify({
          error: "RapidAPI request failed",
          details: error.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('Error in convert-youtube function:', error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});