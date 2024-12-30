import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCloudConvertJob, downloadConvertedFile, getTasksStatus } from "./cloudConvert.ts";
import { uploadToStorage, cleanupTempFile } from "./storage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 60; // 5 minutes maximum (5s * 60)
const RETRY_DELAY = 5000; // 5 secondes entre chaque tentative

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
    
    const jobData = await checkCloudConvertJob(jobId);
    console.log('Cloud Convert job status:', jobData.data.status);
    console.log('Tasks status:', jobData.data.tasks.map(t => `${t.operation}: ${t.status}`).join(', '));

    // Handle specific errors
    if (jobData.data.status === 'error') {
      const failedTask = jobData.data.tasks.find(t => t.status === 'error');
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

    // If job is still in progress
    if (jobData.data.status === 'waiting' || jobData.data.status === 'processing') {
      const totalTasks = jobData.data.tasks.length;
      const completedTasks = jobData.data.tasks.filter(t => t.status === 'finished').length;
      const processingTasks = jobData.data.tasks.filter(t => t.status === 'processing').length;
      const progress = Math.round(((completedTasks + (processingTasks * 0.5)) / totalTasks) * 100);
      
      return new Response(
        JSON.stringify({ 
          status: 'processing',
          progress,
          tasks: getTasksStatus(jobData.data.tasks)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If job is finished
    if (jobData.data.status === 'finished') {
      // Verify all tasks are finished
      const allTasksFinished = jobData.data.tasks.every(t => t.status === 'finished');
      
      if (!allTasksFinished) {
        console.log('Job marked as finished but some tasks are still processing');
        return new Response(
          JSON.stringify({ 
            status: 'processing',
            progress: 90,
            tasks: getTasksStatus(jobData.data.tasks)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find export task
      const exportTask = jobData.data.tasks.find(task => task.operation === 'export/url');
      
      if (!exportTask?.result?.files?.[0]?.url) {
        console.error('No export URL found in completed job:', exportTask);
        throw new Error('No export URL found in completed job');
      }

      const exportUrl = exportTask.result.files[0].url;
      console.log('Export URL found:', exportUrl);

      // Add retries for file download
      let audioBlob = null;
      let downloadError = null;
      
      for (let i = 0; i < 3; i++) {
        try {
          audioBlob = await downloadConvertedFile(exportUrl);
          if (audioBlob && audioBlob.size > 0) {
            break;
          }
        } catch (error) {
          console.error(`Download attempt ${i + 1} failed:`, error);
          downloadError = error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error(`Failed to download file after retries: ${downloadError?.message}`);
      }
      
      // Upload to Supabase Storage with retries
      await uploadToStorage(audioBlob, audioPath);

      // Initialize Supabase client for cleanup
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Clean up temp file
      const tempFileName = audioPath.split('/').pop()?.replace('converted-', '') || '';
      await cleanupTempFile(supabase, tempFileName);

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