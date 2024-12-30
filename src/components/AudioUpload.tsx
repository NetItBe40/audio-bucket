import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import DropZone from "./upload/DropZone";
import UploadProgress from "./upload/UploadProgress";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const AudioUpload = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConverting, setIsConverting] = useState(false);

  const handleUploadComplete = async (audioPath: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non authentifié");

      const { error: insertError } = await supabase
        .from('recordings')
        .insert({
          title: audioPath.split('/').pop() || 'Sans titre',
          file_path: audioPath,
          file_size: 0, // Sera mis à jour par le backend
          user_id: userData.user.id,
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['recordings'] });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    }
  };

  const { uploadFile, isUploading, progress } = useVideoUpload(handleUploadComplete);

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale autorisée est de 1GB",
        variant: "destructive",
      });
      return;
    }

    if (file.type.startsWith('video/')) {
      setIsConverting(true);
      await uploadFile(file);
      setIsConverting(false);
    } else {
      // Upload direct pour les fichiers audio
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non authentifié");

      const timestamp = Date.now();
      const fileName = `${userData.user.id}/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      await handleUploadComplete(fileName);
    }
  };

  return (
    <Card className="p-4">
      <DropZone 
        onFileSelect={handleFileSelect} 
        disabled={isUploading || isConverting}
      />
      <UploadProgress 
        progress={progress}
        isConverting={isConverting}
        isUploading={isUploading}
      />
    </Card>
  );
};

export default AudioUpload;