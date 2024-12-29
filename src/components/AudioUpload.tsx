import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import SaveDialog from "./SaveDialog";
import DropZone from "./upload/DropZone";

// Taille maximale de fichier acceptée par Supabase (50MB en octets)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const AudioUpload = () => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = async (file: File) => {
    // Si c'est un fichier audio, on vérifie juste la taille
    if (file.type.startsWith('audio/')) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille du fichier ne doit pas dépasser 50MB.",
          variant: "destructive",
        });
        return;
      }
      setCurrentFile(file);
      setShowSaveDialog(true);
      return;
    }

    // Si c'est une vidéo et qu'elle dépasse 50MB, on la convertit
    if (file.type.startsWith('video/') && file.size > MAX_FILE_SIZE) {
      try {
        setIsConverting(true);
        toast({
          title: "Conversion en cours",
          description: "La vidéo est en cours de conversion en fichier audio...",
        });

        // Créer une URL signée temporaire pour le fichier
        const { data: signedUrl } = await supabase.storage
          .from('temp-uploads')
          .createSignedUrl(`temp_${Date.now()}`, 3600);

        if (!signedUrl?.signedUrl) throw new Error("Impossible de créer l'URL signée");

        // Appeler la fonction de conversion
        const response = await supabase.functions.invoke('convert-video', {
          body: { videoUrl: signedUrl.signedUrl }
        });

        if (!response.data?.success) {
          throw new Error("Échec de la conversion");
        }

        toast({
          title: "Conversion réussie",
          description: "La vidéo a été convertie en fichier audio avec succès.",
        });

        // Créer un nouveau File object pour l'audio converti
        const audioResponse = await fetch(response.data.audioPath);
        const audioBlob = await audioResponse.blob();
        const audioFile = new File([audioBlob], `converted_${file.name}.mp3`, {
          type: 'audio/mp3'
        });

        setCurrentFile(audioFile);
        setShowSaveDialog(true);

      } catch (error) {
        console.error('Error converting video:', error);
        toast({
          title: "Erreur de conversion",
          description: "Impossible de convertir la vidéo en audio. Veuillez réessayer.",
          variant: "destructive",
        });
      } finally {
        setIsConverting(false);
      }
      return;
    }

    setCurrentFile(file);
    setShowSaveDialog(true);
  };

  const handleSave = async (title: string) => {
    if (!currentFile) return;

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      const fileName = `${user.id}/${Date.now()}.${currentFile.name.split('.').pop()}`;

      const { error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, currentFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("recordings").insert({
        title,
        file_path: fileName,
        file_size: currentFile.size,
        duration: 0,
        user_id: user.id,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      setShowSaveDialog(false);
      setCurrentFile(null);
      toast({
        title: "Succès",
        description: "Le fichier a été importé avec succès.",
      });
    } catch (error) {
      console.error("Error saving file:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'importation.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DropZone 
        onFileSelect={handleFileSelect} 
        disabled={isConverting}
      />
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => {
          setShowSaveDialog(false);
          setCurrentFile(null);
        }}
        onSave={handleSave}
      />
    </>
  );
};

export default AudioUpload;