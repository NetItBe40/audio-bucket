import { useState } from "react";
import { TranscriptionDisplay } from "../TranscriptionDisplay";
import { RecordingHeader } from "./RecordingHeader";
import { Tables } from "@/integrations/supabase/types";
import { DeleteDialog } from "./DeleteDialog";
import { TranscribeDialog } from "./TranscribeDialog";
import { useTranscriptionDialog } from "@/hooks/useTranscriptionDialog";
import { useTranscriptionActions } from "@/hooks/useTranscriptionActions";

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
  const [isTranscriptionVisible, setIsTranscriptionVisible] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const transcription = recording.transcriptions?.[0];

  const {
    showDialog: showTranscribeDialog,
    setShowDialog: setShowTranscribeDialog,
    speakerDetection,
    setSpeakerDetection,
    entityDetection,
    setEntityDetection,
    handleTranscribe,
  } = useTranscriptionDialog(recording.id, onTranscribe);

  const { handleCopyTranscription, handleExportTranscription } = useTranscriptionActions(
    transcription?.text,
    transcription,
    recording.title
  );

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

      <TranscribeDialog
        open={showTranscribeDialog}
        onOpenChange={setShowTranscribeDialog}
        speakerDetection={speakerDetection}
        onSpeakerDetectionChange={setSpeakerDetection}
        entityDetection={entityDetection}
        onEntityDetectionChange={setEntityDetection}
        onConfirm={handleTranscribe}
      />

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
      />
    </div>
  );
};