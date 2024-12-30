import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ytdl from 'https://esm.sh/ytdl-core@4.11.5';

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
    console.log('Starting YouTube conversion process...');
    const { youtubeUrl } = await req.json();
    console.log('Received YouTube URL:', youtubeUrl);

    if (!youtubeUrl) {
      throw new Error('URL YouTube manquante');
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(youtubeUrl)) {
      console.error('Invalid YouTube URL:', youtubeUrl);
      throw new Error('URL YouTube invalide');
    }

    // Get video info
    console.log('Getting video info...');
    const info = await ytdl.getInfo(youtubeUrl);
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    console.log('Video title:', videoTitle);
    
    // Get audio format
    const audioFormat = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio',
      filter: 'audioonly' 
    });

    if (!audioFormat) {
      console.error('No audio format available');
      throw new Error('Aucun format audio disponible');
    }

    console.log('Selected audio format:', audioFormat.mimeType);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download audio and upload to Supabase Storage
    console.log('Downloading audio stream...');
    const response = await fetch(audioFormat.url);
    if (!response.ok) {
      console.error('Download failed:', response.status, response.statusText);
      throw new Error('Échec du téléchargement');
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}-${videoTitle}.mp3`;
    console.log('Uploading to Supabase Storage:', fileName);
    
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('audio-recordings')
      .upload(fileName, response.body, {
        contentType: 'audio/mpeg',
        duplex: 'half'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Échec de l\'upload');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(fileName);

    console.log('Conversion completed successfully');
    
    return new Response(
      JSON.stringify({
        downloadUrl: publicUrl,
        title: videoTitle
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