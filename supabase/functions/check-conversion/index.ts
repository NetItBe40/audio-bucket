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
      const errorText = await response.text();
      console.error('Cloud Convert API error response:', errorText);
      throw new Error(`Cloud Convert API error: ${errorText}`);
    }

    const jobData = await response.json();
    console.log('Cloud Convert job data:', JSON.stringify(jobData, null, 2));

    if (!jobData.data) {
      console.error('Invalid job data received:', jobData);
      throw new Error('Invalid job data received from Cloud Convert');
    }

    console.log('Cloud Convert job status:', jobData.data.status);
    console.log('Tasks status:', jobData.data.tasks.map(t => `${t.operation}: ${t.status}`).join(', '));

    // Si le job est toujours en cours
    if (jobData.data.status === 'waiting' || jobData.data.status === 'processing') {
      // Calculer la progression en fonction des tâches terminées
      const tasks = jobData.data.tasks;
      const completedTasks = tasks.filter(t => t.status === 'finished').length;
      const progress = Math.round((completedTasks / tasks.length) * 100);
      
      return new Response(
        JSON.stringify({ 
          status: jobData.data.status,
          progress,
          tasks: jobData.data.tasks.map(t => ({
            operation: t.operation,
            status: t.status
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si le job a échoué
    if (jobData.data.status === 'error') {
      const errorMessage = jobData.data.message || jobData.data.error?.message || 'Unknown error occurred';
      console.error('Cloud Convert processing error:', errorMessage);
      throw new Error(`Cloud Convert processing error: ${errorMessage}`);
    }

    // Si le job est terminé, on vérifie que toutes les tâches sont bien terminées
    if (jobData.data.status === 'finished') {
      const tasks = jobData.data.tasks;
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

      // Trouver la tâche d'export
      const exportTask = jobData.data.tasks.find(task => task.operation === 'export/url');
      
      if (!exportTask || !exportTask.result?.files?.[0]?.url) {
        console.error('No export URL found in completed job:', exportTask);
        throw new Error('No export URL found in completed job');
      }

      console.log('Downloading converted audio from:', exportTask.result.files[0].url);
      
      // Télécharger le fichier converti
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

      // Initialiser le client Supabase
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      console.log('Uploading to audio-recordings:', audioPath);
      
      // Upload du fichier converti
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

      // Mise à jour de la taille du fichier dans la base de données
      const { error: updateError } = await supabase
        .from('recordings')
        .update({ file_size: audioBlob.size })
        .eq('file_path', audioPath);

      if (updateError) {
        console.error('Failed to update file size:', updateError);
      }

      // Nettoyage du fichier temporaire
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

    // Si on arrive ici, c'est qu'il y a un statut inattendu
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