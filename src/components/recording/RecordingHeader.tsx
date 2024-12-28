import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RecordingControls } from "@/components/RecordingControls";
import { Tables } from "@/integrations/supabase/types";

type RecordingHeaderProps = {
  title: string;
  duration: number | null;
  createdAt: string;
  isPlaying: boolean;
  isTranscribing: boolean;
  transcription?: Tables<"transcriptions">;
  isTranscriptionVisible?: boolean;
  onPlayToggle: () => void;
  onTranscribe: () => void;
  onCopyTranscription?: () => void;
  onToggleTranscriptionVisibility?: () => void;
  onExportTranscription?: () => void;
  onDelete: () => void;
};

export const RecordingHeader = ({
  title,
  duration,
  createdAt,
  isPlaying,
  isTranscribing,
  transcription,
  isTranscriptionVisible,
  onPlayToggle,
  onTranscribe,
  onCopyTranscription,
  onToggleTranscriptionVisibility,
  onExportTranscription,
  onDelete,
}: RecordingHeaderProps) => {
  const formatDuration = (duration: number | null) => {
    if (!duration) return "Durée inconnue";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-gray-500">
          {formatDuration(duration)} -{" "}
          {format(new Date(createdAt), "dd/MM/yyyy", { locale: fr })}
        </p>
      </div>
      <RecordingControls
        isPlaying={isPlaying}
        isTranscribing={isTranscribing}
        transcription={transcription}
        isTranscriptionVisible={isTranscriptionVisible}
        onPlayToggle={onPlayToggle}
        onTranscribe={onTranscribe}
        onCopyTranscription={onCopyTranscription}
        onToggleTranscriptionVisibility={onToggleTranscriptionVisibility}
        onExportTranscription={onExportTranscription}
        onDelete={onDelete}
      />
    </div>
  );
};