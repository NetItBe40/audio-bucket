import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RecordingControls } from "./RecordingControls";

type RecordingHeaderProps = {
  title: string;
  duration: number | null;
  createdAt: string;
  isPlaying: boolean;
  isTranscribing: boolean;
  onPlayToggle: () => void;
  onTranscribe: () => void;
  onDelete: () => void;
};

export const RecordingHeader = ({
  title,
  duration,
  createdAt,
  isPlaying,
  isTranscribing,
  onPlayToggle,
  onTranscribe,
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
        onPlayToggle={onPlayToggle}
        onTranscribe={onTranscribe}
        onDelete={onDelete}
      />
    </div>
  );
};