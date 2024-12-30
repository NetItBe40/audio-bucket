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

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;

      // Upload direct vers temp-uploads avec XHR pour suivre la progression
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

        // Obtenir l'URL signée pour l'upload
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

      // Démarrer la conversion
      const { data, error } = await supabase.functions.invoke('convert-video', {
        body: JSON.stringify({
          fileName,
          originalName: file.name,
        })
      });

      if (error) throw error;

      if (!data?.conversionId || !data?.audioPath) {
        throw new Error('Invalid response from conversion service');
      }

      // Polling pour vérifier l'état de la conversion
      const checkConversion = async () => {
        const { data: statusData, error: statusError } = await supabase.functions.invoke('check-conversion', {
          body: JSON.stringify({
            conversionId: data.conversionId,
            audioPath: data.audioPath,
          })
        });

        if (statusError) throw statusError;

        if (statusData.status === 'completed') {
          onUploadComplete(data.audioPath);
          toast({
            title: "Succès",
            description: "Le fichier a été converti avec succès",
          });
          return;
        }

        if (statusData.status === 'error') {
          throw new Error('Conversion failed');
        }

        // Continuer le polling toutes les 2 secondes
        setTimeout(checkConversion, 2000);
      };

      // Démarrer le polling
      checkConversion();

    } catch (error) {
      console.error('Erreur upload:', error);
      toast({
        title: "Erreur d'upload",
        description: "Une erreur est survenue lors de l'upload du fichier",
        variant: "destructive",
      });
    } finally {
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