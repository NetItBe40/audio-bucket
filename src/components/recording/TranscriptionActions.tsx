import { Button } from "@/components/ui/button";
import { Copy, FileText, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type TranscriptionActionsProps = {
  text: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
};

export const TranscriptionActions = ({
  text,
  isVisible,
  onToggleVisibility,
}: TranscriptionActionsProps) => {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
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

  const handleExport = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcription.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 mb-2">
      <Button variant="outline" size="icon" onClick={handleCopy}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={handleExport}>
        <FileText className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onToggleVisibility}>
        {isVisible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};