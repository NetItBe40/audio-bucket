import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import DropZone from "./upload/DropZone";
import UploadProgress from "./upload/UploadProgress";
import { useVideoConversion } from "@/hooks/useVideoConversion";
import { useQueryClient } from "@tanstack/react-query";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const AudioUpload = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

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

  const { isConverting, progress, convertVideo } = useVideoConversion(async (audioPath) => {
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('audio-recordings')
      .download(audioPath);

    if (downloadError) throw downloadError;

    const audioFile = new File([audioData], audioPath.split('/').pop() || 'converted-audio.mp3', {
      type: 'audio/mpeg',
    });

    await uploadFile(audioFile);
  });

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      if (file.type.startsWith('video/')) {
        await convertVideo(file);
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