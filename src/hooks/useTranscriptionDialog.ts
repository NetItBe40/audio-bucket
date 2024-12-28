import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTranscriptionDialog = (recordingId: string, onTranscribe: () => void) => {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [speakerDetection, setSpeakerDetection] = useState(false);
  const [entityDetection, setEntityDetection] = useState(false);

  const handleTranscribe = async () => {
    try {
      onTranscribe();
      
      const { error } = await supabase.functions.invoke("transcribe", {
        body: { 
          recordingId,
          speakerDetection,
          entityDetection,
        },
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La transcription a démarré",
      });

      setShowDialog(false);
    } catch (error) {
      console.error("Error starting transcription:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de démarrer la transcription",
      });
    }
  };

  return {
    showDialog,
    setShowDialog,
    speakerDetection,
    setSpeakerDetection,
    entityDetection,
    setEntityDetection,
    handleTranscribe,
  };
};