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

      // Upload direct vers temp-uploads
      const { error: uploadError } = await supabase.storage
        .from('temp-uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Appeler l'Edge Function pour la conversion
      const { data, error } = await supabase.functions.invoke('convert-video', {
        body: JSON.stringify({
          fileName,
          originalName: file.name,
        })
      });

      if (error) throw error;

      if (data?.audioPath) {
        onUploadComplete(data.audioPath);
        toast({
          title: "Succès",
          description: "Le fichier a été converti avec succès",
        });
      }
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