import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createChunks, blobToBase64, delay, MAX_RETRIES, RETRY_DELAY } from "@/utils/fileChunking";

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

      const chunks = createChunks(file);
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}-${randomString}-${file.name}`;
      
      console.log(`Starting conversion of ${file.name} in ${chunks.length} chunks`);
      
      for (let i = 0; i < chunks.length; i++) {
        let retries = 0;
        let success = false;
        
        while (!success && retries < MAX_RETRIES) {
          try {
            const chunk = chunks[i];
            console.log(`Processing chunk ${i + 1}/${chunks.length}, size: ${chunk.size} bytes, attempt ${retries + 1}`);
            
            const base64Chunk = await blobToBase64(chunk);
            const { data, error } = await supabase.functions.invoke('convert-large-video', {
              body: JSON.stringify({
                videoChunk: base64Chunk,
                fileName,
                chunkIndex: i,
                totalChunks: chunks.length,
                userId: userData.user.id,
              }),
            });

            if (error) throw error;
            
            console.log(`Chunk ${i + 1}/${chunks.length} processed successfully`);
            success = true;
            
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
            
            if (i === chunks.length - 1 && data.audioPath) {
              await onConversionComplete(data.audioPath);
            }
          } catch (error) {
            console.error(`Error processing chunk ${i + 1}, attempt ${retries + 1}:`, error);
            retries++;
            if (retries < MAX_RETRIES) {
              await delay(RETRY_DELAY * retries);
            } else {
              throw new Error(`Failed to process chunk ${i + 1} after ${MAX_RETRIES} attempts`);
            }
          }
        }
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