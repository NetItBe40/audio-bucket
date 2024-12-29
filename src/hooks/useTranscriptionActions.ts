import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";

export const useTranscriptionActions = (
  transcriptionText?: string,
  transcription?: Tables<"transcriptions">,
  recordingTitle?: string
) => {
  const { toast } = useToast();

  const handleCopyTranscription = async () => {
    if (!transcriptionText) return;
    try {
      await navigator.clipboard.writeText(transcriptionText);
      toast({
        title: "Succès",
        description: "Le texte a été copié dans le presse-papier",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de copier le texte",
      });
    }
  };

  const handleExportTranscription = () => {
    if (!transcriptionText || !recordingTitle) return;

    // Format the date for the filename
    const dateStr = format(new Date(), "yyyy-MM-dd", { locale: fr });
    const fileName = `${recordingTitle}_${dateStr}.txt`;

    // Prepare the content based on whether we have speaker labels
    let content = transcriptionText;
    if (
      transcription?.speaker_detection &&
      transcription.speaker_labels &&
      Array.isArray(transcription.speaker_labels)
    ) {
      content = (transcription.speaker_labels as Array<{
        speaker: string;
        text: string;
      }>)
        .map((utterance) => `${utterance.speaker}: ${utterance.text}`)
        .join("\n\n");
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    handleCopyTranscription,
    handleExportTranscription,
  };
};