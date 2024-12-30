import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useVideoUpload = (onUploadComplete: (path: string) => void) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setProgress(0);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non authentifié");

      // Sanitize filename by replacing spaces with underscores
      const sanitizedFileName = file.name.replace(/\s+/g, '_');
      const timestamp = Date.now();
      const fileName = `${timestamp}-${sanitizedFileName}`;

      // Upload to temp-uploads with XHR for progress tracking
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setProgress(Math.round(percentComplete));
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            resolve(xhr.response);
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        // Get signed URL for upload
        supabase.storage
          .from('temp-uploads')
          .createSignedUploadUrl(fileName)
          .then(({ data, error }) => {
            if (error) throw error;
            if (!data?.signedUrl) throw new Error('No signed URL');
            
            xhr.open('PUT', data.signedUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
          })
          .catch(reject);
      });

      console.log('File uploaded successfully to temp-uploads:', fileName);

      // Start conversion
      const { data, error } = await supabase.functions.invoke('convert-video', {
        body: JSON.stringify({
          fileName,
          originalName: sanitizedFileName,
        })
      });

      if (error) {
        console.error('Conversion error:', error);
        throw error;
      }

      if (!data?.conversionId || !data?.audioPath) {
        console.error('Invalid response from conversion service:', data);
        throw new Error('Invalid response from conversion service');
      }

      console.log('Conversion started:', { conversionId: data.conversionId, audioPath: data.audioPath });

      // Polling to check conversion status
      const checkConversion = async () => {
        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('check-conversion', {
            body: JSON.stringify({
              jobId: data.conversionId,
              audioPath: data.audioPath,
            })
          });

          if (statusError) throw statusError;

          if (statusData.error) {
            throw new Error(`Conversion error: ${statusData.error}`);
          }

          if (statusData.status === 'completed') {
            onUploadComplete(data.audioPath);
            toast({
              title: "Succès",
              description: "Le fichier a été converti avec succès",
            });
            return;
          }

          if (statusData.status === 'error') {
            throw new Error(`Conversion failed: ${statusData.details || 'Unknown error'}`);
          }

          // Update progress if available
          if (statusData.progress) {
            setProgress(statusData.progress);
          }

          // Continue polling every 2 seconds
          setTimeout(checkConversion, 2000);
        } catch (error) {
          console.error('Conversion check error:', error);
          toast({
            title: "Erreur de conversion",
            description: error.message || "Une erreur est survenue lors de la conversion",
            variant: "destructive",
          });
          setIsUploading(false);
          setProgress(0);
        }
      };

      // Start polling
      checkConversion();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue lors de l'upload du fichier",
        variant: "destructive",
      });
      setIsUploading(false);
      setProgress(0);
    }
  };

  return {
    uploadFile,
    isUploading,
    progress
  };
};