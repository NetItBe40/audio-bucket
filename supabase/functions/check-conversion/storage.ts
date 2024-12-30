import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function uploadToStorage(audioBlob: Blob, audioPath: string, maxRetries = 3) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Upload attempt ${i + 1} for ${audioPath}`);
      
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

        console.log(`File verified successfully, size: ${fileData.size} bytes`);
        return { success: true };
      }
      
      lastError = uploadError;
      console.error(`Upload attempt ${i + 1} failed:`, uploadError);
    } catch (error) {
      lastError = error;
      console.error(`Upload attempt ${i + 1} failed with error:`, error);
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error(`Failed to upload file after ${maxRetries} attempts: ${lastError?.message}`);
}

export async function cleanupTempFile(supabase: any, tempFileName: string) {
  if (tempFileName) {
    console.log('Cleaning up temporary file:', tempFileName);
    await supabase.storage
      .from('temp-uploads')
      .remove([tempFileName]);
  }
}