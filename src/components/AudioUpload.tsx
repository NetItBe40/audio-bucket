import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DropZone from "./upload/DropZone";
import { useQueryClient } from "@tanstack/react-query";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

const AudioUpload = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const queryClient = useQueryClient();

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      if (file.type.startsWith('video/')) {
        // Si c'est une vidéo, on propose la conversion
        handleVideoConversion(file);
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

  const handleVideoConversion = async (file: File) => {
    setIsConverting(true);
    toast({
      title: "Conversion en cours",
      description: "La vidéo est en cours de conversion en fichier audio...",
    });

    try {
      // Upload to temp bucket first
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('temp-uploads')
        .upload(`temp-${Date.now()}-${file.name}`, file);

      if (uploadError) throw uploadError;

      // Call the conversion function
      const response = await fetch('/api/convert-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: uploadData.path,
        }),
      });

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      const { audioPath } = await response.json();

      // Download the converted audio file
      const { data: audioData, error: downloadError } = await supabase.storage
        .from('audio-recordings')
        .download(audioPath);

      if (downloadError) throw downloadError;

      // Create a new file from the audio data
      const audioFile = new File([audioData], audioPath.split('/').pop() || 'converted-audio.mp3', {
        type: 'audio/mpeg',
      });

      // Upload the audio file
      await uploadFile(audioFile);

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
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    const fileName = `${Date.now()}-${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('recordings')
        .insert({
          title: file.name,
          file_path: fileName,
          file_size: file.size,
          duration: null, // Will be updated later
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
        <div className="mt-4 text-center text-sm text-gray-500">
          {isConverting ? "Conversion en cours..." : "Upload en cours..."}
        </div>
      )}
    </Card>
  );
};

export default AudioUpload;