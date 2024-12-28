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
import { Button } from "@/components/ui/button";
import { TranscriptionDisplay } from "../TranscriptionDisplay";
import { RecordingHeader } from "./RecordingHeader";
import { TranscriptionActions } from "./TranscriptionActions";
import { Tables } from "@/integrations/supabase/types";

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
  const [isTranscriptionVisible, setIsTranscriptionVisible] = useState(true);
  const transcription = recording.transcriptions?.[0];

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
      <RecordingHeader
        title={recording.title}
        duration={recording.duration}
        createdAt={recording.created_at}
        isPlaying={isPlaying}
        isTranscribing={isTranscribing}
        onPlayToggle={onPlayToggle}
        onTranscribe={onTranscribe}
        onDelete={() => {}}
      />

      {transcription && (
        <>
          <TranscriptionActions
            text={transcription.text || ""}
            isVisible={isTranscriptionVisible}
            onToggleVisibility={() => setIsTranscriptionVisible(!isTranscriptionVisible)}
          />
          {isTranscriptionVisible && (
            <TranscriptionDisplay transcription={transcription} />
          )}
        </>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 hover:text-red-700"
          >
            Supprimer l'enregistrement
          </Button>
        </AlertDialogTrigger>
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
            <AlertDialogAction onClick={onDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};