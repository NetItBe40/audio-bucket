import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TranscriptionDisplay } from "../TranscriptionDisplay";
import { RecordingHeader } from "./RecordingHeader";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/components/ui/use-toast";

type RecordingItemProps = {
  recording: Tables<"recordings"> & {
    transcriptions: Tables<"transcriptions">[];
  };
  isPlaying: boolean;
  isTranscribing: boolean;
  onPlayToggle: () => void;
  onTranscribe: () => void;
  onDelete: () => void;
};

export const RecordingItem = ({
  recording,
  isPlaying,
  isTranscribing,
  onPlayToggle,
  onTranscribe,
  onDelete,
}: RecordingItemProps) => {
  const { toast } = useToast();
  const [isTranscriptionVisible, setIsTranscriptionVisible] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const transcription = recording.transcriptions?.[0];

  const handleCopyTranscription = async () => {
    if (!transcription?.text) return;
    try {
      await navigator.clipboard.writeText(transcription.text);
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
    if (!transcription?.text) return;
    const blob = new Blob([transcription.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recording.title}-transcription.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    setShowDeleteDialog(false);
    onDelete();
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
      <RecordingHeader
        title={recording.title}
        duration={recording.duration}
        createdAt={recording.created_at}
        isPlaying={isPlaying}
        isTranscribing={isTranscribing}
        transcription={transcription}
        isTranscriptionVisible={isTranscriptionVisible}
        onPlayToggle={onPlayToggle}
        onTranscribe={onTranscribe}
        onCopyTranscription={handleCopyTranscription}
        onToggleTranscriptionVisibility={() => setIsTranscriptionVisible(!isTranscriptionVisible)}
        onExportTranscription={handleExportTranscription}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {transcription && isTranscriptionVisible && (
        <TranscriptionDisplay transcription={transcription} />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'enregistrement et sa transcription
              seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};