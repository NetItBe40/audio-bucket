import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTranscription = (onSuccess: () => void) => {
  const { toast } = useToast();
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());

  const handleTranscribe = async (id: string) => {
    try {
      setTranscribingIds((prev) => new Set(prev).add(id));

      const { error } = await supabase.functions.invoke("transcribe", {
        body: { recordingId: id },
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La transcription a démarré",
      });

      onSuccess();
    } catch (error) {
      console.error("Error starting transcription:", error);
      setTranscribingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de démarrer la transcription",
      });
    }
  };

  return {
    transcribingIds,
    setTranscribingIds,
    handleTranscribe,
  };
};