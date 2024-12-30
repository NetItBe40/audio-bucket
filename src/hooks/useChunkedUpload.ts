import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createChunks, getChunkProgress } from "@/utils/chunkUtils";
import { useToast } from "./use-toast";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const useChunkedUpload = (onUploadComplete: (path: string) => void) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const uploadChunk = async (
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    retryCount = 0
  ): Promise<boolean> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non authentifié");

      const timestamp = Date.now();
      const chunkName = `${userData.user.id}/temp/${timestamp}-chunk-${chunkIndex}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('temp-uploads')
        .upload(chunkName, chunk);

      if (uploadError) throw uploadError;

      setProgress(getChunkProgress(chunkIndex, totalChunks));
      return true;
    } catch (error) {
      console.error(`Erreur upload chunk ${chunkIndex}:`, error);
      
      if (retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY * (retryCount + 1));
        return uploadChunk(chunk, chunkIndex, totalChunks, fileName, retryCount + 1);
      }
      
      throw error;
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setProgress(0);

    try {
      const chunks = createChunks(file);
      console.log(`Début upload en ${chunks.length} chunks`);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non authentifié");

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;

      // Upload tous les chunks
      for (let i = 0; i < chunks.length; i++) {
        await uploadChunk(chunks[i], i, chunks.length, fileName);
      }

      // Appeler l'Edge Function pour traiter les chunks
      const { data, error } = await supabase.functions.invoke('convert-large-video', {
        body: JSON.stringify({
          fileName,
          totalChunks: chunks.length,
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