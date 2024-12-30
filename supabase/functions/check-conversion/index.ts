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
      return new Response(
        JSON.stringify({ 
          error: true,
          message: "Paramètres manquants",
          details: "jobId et audioPath sont requis"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
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
      const errorText = await response.text();
      console.error('Cloud Convert API error:', errorText);
      throw new Error(`Cloud Convert API error: ${errorText}`);
    }

    const jobData = await response.json();
    console.log('Cloud Convert job data:', JSON.stringify(jobData, null, 2));

    if (!jobData.data) {
      console.error('Invalid job data received:', jobData);
      throw new Error('Invalid job data received from Cloud Convert');
    }

    // Vérifier si le job existe et a des tâches
    if (!jobData.data.tasks || jobData.data.tasks.length === 0) {
      throw new Error('No tasks found in job data');
    }

    console.log('Cloud Convert job status:', jobData.data.status);
    console.log('Tasks status:', jobData.data.tasks.map(t => `${t.operation}: ${t.status}`).join(', '));

    // Handle specific errors
    if (jobData.data.status === 'error') {
      const failedTask = jobData.data.tasks.find(t => t.status === 'error');
      return handleJobError(failedTask, corsHeaders);
    }

    // If job is still in progress
    if (jobData.data.status === 'waiting' || jobData.data.status === 'processing') {
      return handleJobInProgress(jobData.data.tasks, corsHeaders);
    }

    // If job is finished
    if (jobData.data.status === 'finished') {
      return await handleJobFinished(jobData.data.tasks, audioPath, corsHeaders);
    }

    // If we get here, it's an unexpected status
    throw new Error(`Unexpected job status: ${jobData.data.status}`);

  } catch (error) {
    console.error('Error in check-conversion:', error);
    return new Response(
      JSON.stringify({ 
        error: true,
        message: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function handleJobFinished(tasks, audioPath, corsHeaders) {
  // Verify all tasks are finished
  const allTasksFinished = tasks.every(t => t.status === 'finished');
  
  if (!allTasksFinished) {
    console.log('Job marked as finished but some tasks are still processing');
    return new Response(
      JSON.stringify({ 
        status: 'processing',
        progress: 90,
        tasks: tasks.map(t => ({
          operation: t.operation,
          status: t.status
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find export task
  const exportTask = tasks.find(task => task.operation === 'export/url');
  
  if (!exportTask?.result?.files?.[0]?.url) {
    console.error('No export URL found in completed job:', exportTask);
    throw new Error('No export URL found in completed job');
  }

  const exportUrl = exportTask.result.files[0].url;
  console.log('Downloading converted audio from:', exportUrl);
  
  // Download converted file
  const audioResponse = await fetch(exportUrl);
  
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
  
  // Upload converted file with retries
  const maxRetries = 3;
  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(audioPath, audioBlob, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (!uploadError) {
        console.log('Audio file uploaded successfully');
        
        // Verify the uploaded file
        const { data: fileData, error: fileError } = await supabase.storage
          .from('audio-recordings')
          .download(audioPath);
          
        if (fileError) {
          throw new Error(`Failed to verify uploaded file: ${fileError.message}`);
        }
        
        if (!fileData || fileData.size === 0) {
          throw new Error('Uploaded file verification failed: file is empty');
        }

        // Clean up temp file
        const tempFileName = audioPath.split('/').pop()?.replace('converted-', '') || '';
        if (tempFileName) {
          console.log('Cleaning up temporary file:', tempFileName);
          await supabase.storage
            .from('temp-uploads')
            .remove([tempFileName]);
        }

        return new Response(
          JSON.stringify({ 
            status: 'completed',
            progress: 100,
            audioPath,
            size: audioBlob.size
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      lastError = uploadError;
      console.error(`Upload attempt ${i + 1} failed:`, uploadError);
    } catch (error) {
      lastError = error;
      console.error(`Upload attempt ${i + 1} failed with error:`, error);
    }
    
    // Wait before retrying
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(`Failed to upload file after ${maxRetries} attempts: ${lastError?.message}`);
}

function handleJobError(failedTask, corsHeaders) {
  const errorCode = failedTask?.code || 'UNKNOWN_ERROR';
  const errorMessage = failedTask?.message || 'Une erreur inconnue est survenue';
  
  let userMessage;
  switch (errorCode) {
    case 'DOWNLOAD_FAILED':
      userMessage = "Échec du téléchargement du fichier source";
      break;
    case 'CONVERSION_FAILED':
      userMessage = "Échec de la conversion du fichier";
      break;
    case 'UPLOAD_FAILED':
      userMessage = "Échec de l'upload du fichier converti";
      break;
    case 'INVALID_FILE':
      userMessage = "Format de fichier non supporté";
      break;
    default:
      userMessage = errorMessage;
  }

  return new Response(
    JSON.stringify({ 
      error: true,
      status: 'error',
      message: userMessage,
      details: {
        code: errorCode,
        originalMessage: errorMessage
      }
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    }
  );
}

function handleJobInProgress(tasks, corsHeaders) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'finished').length;
  const processingTasks = tasks.filter(t => t.status === 'processing').length;
  const progress = Math.round(((completedTasks + (processingTasks * 0.5)) / totalTasks) * 100);
  
  return new Response(
    JSON.stringify({ 
      status: 'processing',
      progress,
      tasks: tasks.map(t => ({
        operation: t.operation,
        status: t.status,
        percent: t.percent
      }))
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}