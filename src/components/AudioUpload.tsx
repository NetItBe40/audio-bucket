import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import DropZone from "./upload/DropZone";
import { useQueryClient } from "@tanstack/react-query";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks for better reliability
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const AudioUpload = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      if (file.type.startsWith('video/')) {
        handleLargeVideoConversion(file);
      } else {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale autorisée est de 50MB",
          variant: "destructive",
        });
      }
      return;
    }

    await uploadFile(file);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleLargeVideoConversion = async (file: File) => {
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

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      
      console.log(`Starting conversion of ${file.name} in ${totalChunks} chunks`);
      
      for (let i = 0; i < totalChunks; i++) {
        let retries = 0;
        let success = false;
        
        while (!success && retries < MAX_RETRIES) {
          try {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            
            console.log(`Processing chunk ${i + 1}/${totalChunks}, size: ${chunk.size} bytes, attempt ${retries + 1}`);
            
            const base64Chunk = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64.split(',')[1]);
              };
              reader.readAsDataURL(chunk);
            });

            const { data, error } = await supabase.functions.invoke('convert-large-video', {
              body: JSON.stringify({
                videoChunk: base64Chunk,
                fileName: `${timestamp}-${randomString}-${file.name}`,
                chunkIndex: i,
                totalChunks,
                userId: userData.user.id,
              }),
            });

            if (error) throw error;
            
            console.log(`Chunk ${i + 1}/${totalChunks} processed successfully`);
            success = true;
            
            // Update progress
            setProgress(Math.round(((i + 1) / totalChunks) * 100));
            
            if (i === totalChunks - 1 && data.audioPath) {
              const { data: audioData, error: downloadError } = await supabase.storage
                .from('audio-recordings')
                .download(data.audioPath);

              if (downloadError) throw downloadError;

              const audioFile = new File([audioData], data.audioPath.split('/').pop() || 'converted-audio.mp3', {
                type: 'audio/mpeg',
              });

              await uploadFile(audioFile);
            }
          } catch (error) {
            console.error(`Error processing chunk ${i + 1}, attempt ${retries + 1}:`, error);
            retries++;
            if (retries < MAX_RETRIES) {
              await delay(RETRY_DELAY * retries); // Exponential backoff
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

  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("User not authenticated");

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileName = `${userData.user.id}/${timestamp}-${randomString}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('recordings')
        .insert({
          title: file.name,
          file_path: fileName,
          file_size: file.size,
          duration: null,
          user_id: userData.user.id,
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['recordings'] });

      toast({
        title: "Upload réussi",
        description: "Le fichier a été uploadé avec succès",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erreur d'upload",
        description: "Une erreur est survenue lors de l'upload du fichier",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-4">
      <DropZone 
        onFileSelect={handleFileSelect} 
        disabled={isUploading || isConverting}
      />
      {(isUploading || isConverting) && (
        <div className="mt-4 space-y-2">
          <div className="text-center text-sm text-gray-500">
            {isConverting ? "Conversion en cours..." : "Upload en cours..."}
          </div>
          {isConverting && progress > 0 && (
            <div className="text-center text-sm text-gray-500">
              {progress}% complété
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default AudioUpload;