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
    const { conversionId, audioPath } = await req.json();
    
    if (!conversionId || !audioPath) {
      throw new Error('Missing required parameters');
    }

    console.log(`Checking conversion status for ID: ${conversionId}`);
    
    // Vérifier le statut de la conversion avec AssemblyAI
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${conversionId}`,
      {
        headers: {
          'Authorization': Deno.env.get('ASSEMBLYAI_API_KEY') ?? '',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('AssemblyAI API error response:', error);
      throw new Error(`AssemblyAI API error: ${error}`);
    }

    const data = await response.json();
    console.log('AssemblyAI status:', data.status);

    // Si la conversion n'est pas terminée, retourner le statut actuel
    if (data.status === 'queued' || data.status === 'processing') {
      return new Response(
        JSON.stringify({ status: data.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si une erreur s'est produite pendant la conversion
    if (data.status === 'error') {
      console.error('AssemblyAI processing error:', data.error);
      throw new Error(`AssemblyAI processing error: ${data.error}`);
    }

    // Si la conversion est terminée
    if (data.status === 'completed' && data.audio_url) {
      console.log('Conversion completed. Downloading audio from:', data.audio_url);
      
      // Télécharger le fichier audio converti
      const audioResponse = await fetch(data.audio_url);
      
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
      
      // Upload le fichier converti
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

      // Mettre à jour la taille du fichier dans la base de données
      const { error: updateError } = await supabase
        .from('recordings')
        .update({ file_size: audioBlob.size })
        .eq('file_path', audioPath);

      if (updateError) {
        console.error('Failed to update file size:', updateError);
      }

      // Nettoyer le fichier temporaire
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

    // Si on arrive ici, c'est qu'il y a un problème avec le statut
    throw new Error(`Unexpected conversion status: ${data.status}`);

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