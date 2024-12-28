import { useToast } from "@/components/ui/use-toast";

export const useTranscriptionActions = (transcriptionText?: string) => {
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
    if (!transcriptionText) return;
    const blob = new Blob([transcriptionText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription.txt`;
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