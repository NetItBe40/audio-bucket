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
    const { jobId, audioPath } = await req.json();
    
    if (!jobId || !audioPath) {
      throw new Error('Missing required parameters');
    }

    console.log(`Checking conversion status for job ID: ${jobId}`);
    
    // Check job status with Cloud Convert
    const response = await fetch(
      `https://api.cloudconvert.com/v2/jobs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('CLOUDCONVERT_API_KEY')}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Cloud Convert API error:', error);
      throw new Error(`Cloud Convert API error: ${error}`);
    }

    const jobData = await response.json();
    console.log('Cloud Convert job status:', jobData.data.status);

    // If the job is still running, return the current status
    if (jobData.data.status === 'waiting' || jobData.data.status === 'processing') {
      return new Response(
        JSON.stringify({ status: jobData.data.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If the job failed
    if (jobData.data.status === 'error') {
      console.error('Cloud Convert processing error:', jobData.data.message);
      throw new Error(`Cloud Convert processing error: ${jobData.data.message}`);
    }

    // If the job is completed
    if (jobData.data.status === 'finished') {
      // Find the export task
      const exportTask = jobData.data.tasks.find(task => task.operation === 'export/url');
      
      if (!exportTask || !exportTask.result?.files?.[0]?.url) {
        throw new Error('No export URL found in completed job');
      }

      console.log('Downloading converted audio from:', exportTask.result.files[0].url);
      
      // Download the converted file
      const audioResponse = await fetch(exportTask.result.files[0].url);
      
      if (!audioResponse.ok) {
        console.error('Audio download failed:', audioResponse.statusText);
        throw new Error(`Failed to download converted audio: ${audioResponse.statusText}`);
      }

      const audioBlob = await audioResponse.blob();
      console.log('Audio file downloaded, size:', audioBlob.size);
      
      if (audioBlob.size === 0) {
        throw new Error('Downloaded audio file is empty');
      }

      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      console.log('Uploading to audio-recordings:', audioPath);
      
      // Upload the converted file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(audioPath, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload error: ${uploadError.message}`);
      }

      console.log('Audio file uploaded successfully');

      // Update the file size in the database
      const { error: updateError } = await supabase
        .from('recordings')
        .update({ file_size: audioBlob.size })
        .eq('file_path', audioPath);

      if (updateError) {
        console.error('Failed to update file size:', updateError);
      }

      // Clean up the temporary file
      const tempFileName = audioPath.split('/').pop()?.replace('converted-', '') || '';
      if (tempFileName) {
        console.log('Cleaning up temporary file:', tempFileName);
        const { error: deleteError } = await supabase.storage
          .from('temp-uploads')
          .remove([tempFileName]);

        if (deleteError) {
          console.error('Failed to delete temporary file:', deleteError);
        }
      }

      return new Response(
        JSON.stringify({ 
          status: 'completed',
          audioPath,
          size: audioBlob.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we get here, there's an unexpected status
    throw new Error(`Unexpected job status: ${jobData.data.status}`);

  } catch (error) {
    console.error('Error in check-conversion:', error);
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