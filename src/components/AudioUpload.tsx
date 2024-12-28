import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import SaveDialog from "./SaveDialog";
import DropZone from "./upload/DropZone";

const AudioUpload = () => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (file: File) => {
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