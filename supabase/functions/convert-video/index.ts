import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName } = await req.json();
    
    if (!fileName) {
      return new Response(
        JSON.stringify({ 
          error: true,
          message: "Nom de fichier manquant",
          details: null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const cloudConvertApiKey = Deno.env.get('CLOUDCONVERT_API_KEY');
    if (!cloudConvertApiKey) {
      return new Response(
        JSON.stringify({ 
          error: true,
          message: "Clé API CloudConvert non configurée",
          details: null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    console.log(`Starting conversion for file: ${fileName}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('temp-uploads')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for file');
    }

    const publicUrl = urlData.publicUrl;
    console.log('File public URL:', publicUrl);

    // Create a job with Cloud Convert using optimized parameters
    console.log('Creating Cloud Convert job...');
    const response = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudConvertApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          "import": {
            operation: "import/url",
            url: publicUrl,
            filename: fileName
          },
          "convert": {
            operation: "convert",
            input: ["import"],
            output_format: "mp3",
            engine: "ffmpeg",
            audio_codec: "libmp3lame",
            audio_bitrate: 192000,
            audio_frequency: 44100,
            audio_channels: 2,
            audio_quality: 0, // Meilleure qualité pour libmp3lame
          },
          "export": {
            operation: "export/url",
            input: ["convert"],
            inline: false,
            archive_multiple_files: false
          }
        },
        tag: "audio-conversion"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloud Convert API error:', errorText);
      throw new Error(`Cloud Convert API error: ${errorText}`);
    }

    const jobData = await response.json();
    console.log('Cloud Convert job created:', JSON.stringify(jobData, null, 2));

    if (!jobData.data?.id) {
      console.error('Invalid job data received:', jobData);
      throw new Error('Invalid job data received from Cloud Convert');
    }

    // Create the target audio filename
    const timestamp = Date.now();
    const audioFileName = `converted-${timestamp}-${fileName.replace(/\s+/g, '_').replace(/\.[^/.]+$/, '')}.mp3`;

    console.log('Job created successfully:', {
      jobId: jobData.data.id,
      audioPath: audioFileName
    });

    return new Response(
      JSON.stringify({ 
        conversionId: jobData.data.id,
        audioPath: audioFileName,
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error in convert-video function:', error);
    return new Response(
      JSON.stringify({ 
        error: true,
        message: error.message,
        details: error.stack 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    );
  }
});