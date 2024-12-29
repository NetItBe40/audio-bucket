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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (file: File) => {
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
      <DropZone onFileSelect={handleFileSelect} />
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