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
    console.log('Received request with URL:', youtubeUrl);
    
    if (!youtubeUrl) {
      console.error('No YouTube URL provided');
      return new Response(
        JSON.stringify({ 
          error: 'Missing YouTube URL',
          details: 'A valid YouTube URL is required'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Validate YouTube URL format
    if (!youtubeUrl.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)) {
      console.error('Invalid YouTube URL format:', youtubeUrl);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid YouTube URL',
          details: 'Please provide a valid YouTube video URL'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('Making request to RapidAPI with URL:', youtubeUrl);
    const convertUrl = 'https://youtube-to-mp315.p.rapidapi.com/download';
    const options = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
      },
      body: JSON.stringify({ url: youtubeUrl })
    };

    const response = await fetch(convertUrl, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('RapidAPI error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      // Check for rate limit error
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            details: 'The monthly quota for YouTube conversions has been exceeded. Please try again next month or contact support.',
            isRateLimit: true
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'RapidAPI request failed',
          details: errorText
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status
        }
      );
    }

    const result = await response.json();
    console.log('Initial conversion result:', result);

    if (result.status === 'CONVERTING' && result.id) {
      let attempts = 0;
      const maxAttempts = 12; // 2 minutes maximum

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds between checks
        
        console.log(`Checking conversion status (attempt ${attempts + 1}/${maxAttempts})...`);
        const statusUrl = `https://youtube-to-mp315.p.rapidapi.com/status/${result.id}`;
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: options.headers
        });
        
        if (!statusResponse.ok) {
          console.error('Status check failed:', {
            status: statusResponse.status,
            statusText: statusResponse.statusText
          });
          return new Response(
            JSON.stringify({ 
              error: 'Failed to check conversion status',
              details: await statusResponse.text()
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: statusResponse.status
            }
          );
        }

        const statusResult = await statusResponse.json();
        console.log(`Status check attempt ${attempts + 1}:`, statusResult);

        if (statusResult.status === 'AVAILABLE') {
          console.log('Conversion successful, download URL:', statusResult.downloadUrl);
          
          return new Response(
            JSON.stringify({
              downloadUrl: statusResult.downloadUrl,
              title: statusResult.title,
              contentType: 'audio/mpeg'
            }),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            }
          );
        }

        if (statusResult.status === 'EXPIRED' || statusResult.status === 'CONVERSION_ERROR') {
          console.error('Conversion failed with status:', statusResult.status);
          return new Response(
            JSON.stringify({ 
              error: `Conversion failed: ${statusResult.status}`,
              details: statusResult
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          );
        }

        attempts++;
      }

      return new Response(
        JSON.stringify({ 
          error: 'Conversion timeout',
          details: 'Process took too long'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 408
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Unexpected conversion status',
        details: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );

  } catch (error) {
    console.error('Error details:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});