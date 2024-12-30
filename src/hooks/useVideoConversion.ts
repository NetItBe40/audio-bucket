import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useVideoConversion = (onConversionComplete: (audioPath: string) => Promise<void>) => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const convertVideo = async (file: File) => {
    setIsConverting(true);
    setProgress(0);
    
    toast({
      title: "Conversion en cours",
      description: "La vidéo est en cours de conversion en fichier audio...",
    });

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("User not authenticated");

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}-${randomString}-${file.name}`;
      
      console.log(`Starting conversion of ${file.name}`);
      
      const { data, error } = await supabase.functions.invoke('convert-video', {
        body: JSON.stringify({
          fileName,
          originalName: file.name,
          userId: userData.user.id,
        }),
      });

      if (error) throw error;
      
      if (data?.audioPath) {
        await onConversionComplete(data.audioPath);
      }

      toast({
        title: "Conversion réussie",
        description: "La vidéo a été convertie en audio avec succès",
      });
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        title: "Erreur de conversion",
        description: "Une erreur est survenue lors de la conversion de la vidéo",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  };

  return {
    isConverting,
    progress,
    convertVideo,
  };
};