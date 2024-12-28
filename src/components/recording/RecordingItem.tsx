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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TranscriptionDisplay } from "../TranscriptionDisplay";
import { RecordingHeader } from "./RecordingHeader";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  onDelete,
  onTranscribe,
}: RecordingItemProps) => {
  const { toast } = useToast();
  const [isTranscriptionVisible, setIsTranscriptionVisible] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTranscribeDialog, setShowTranscribeDialog] = useState(false);
  const [speakerDetection, setSpeakerDetection] = useState(false);
  const transcription = recording.transcriptions?.[0];

  const handleTranscribe = async () => {
    try {
      // Appeler onTranscribe avant de démarrer la transcription pour mettre à jour l'état
      onTranscribe();
      
      const { error } = await supabase.functions.invoke("transcribe", {
        body: { 
          recordingId: recording.id,
          speakerDetection,
        },
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La transcription a démarré",
      });

      setShowTranscribeDialog(false);
    } catch (error) {
      console.error("Error starting transcription:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de démarrer la transcription",
      });
    }
  };

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
    <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm space-y-3 sm:space-y-4">
      <RecordingHeader
        title={recording.title}
        duration={recording.duration}
        createdAt={recording.created_at}
        isPlaying={isPlaying}
        isTranscribing={isTranscribing}
        transcription={transcription}
        isTranscriptionVisible={isTranscriptionVisible}
        onPlayToggle={onPlayToggle}
        onTranscribe={() => setShowTranscribeDialog(true)}
        onCopyTranscription={handleCopyTranscription}
        onToggleTranscriptionVisibility={() => setIsTranscriptionVisible(!isTranscriptionVisible)}
        onExportTranscription={handleExportTranscription}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {transcription && isTranscriptionVisible && (
        <TranscriptionDisplay transcription={transcription} />
      )}

      <Dialog open={showTranscribeDialog} onOpenChange={setShowTranscribeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Options de transcription</DialogTitle>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <Switch
              id="speaker-detection"
              checked={speakerDetection}
              onCheckedChange={setSpeakerDetection}
            />
            <Label htmlFor="speaker-detection">
              Activer la détection des intervenants
            </Label>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
              onClick={() => setShowTranscribeDialog(false)}
            >
              Annuler
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
              onClick={handleTranscribe}
            >
              Démarrer
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-[425px]">
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