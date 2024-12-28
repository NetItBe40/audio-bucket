import { Button } from "@/components/ui/button";
import { Play, Square, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RecordingItemProps {
  recording: {
    id: string;
    title: string;
    duration: number | null;
    created_at: string;
    file_path: string;
  };
  playingId: string | null;
  onPlayToggle: (id: string, filePath: string) => void;
  onDelete: (id: string, filePath: string) => void;
}

const RecordingItem = ({
  recording,
  playingId,
  onPlayToggle,
  onDelete,
}: RecordingItemProps) => {
  const formatDuration = (duration: number | null) => {
    if (!duration) return "Durée inconnue";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
      <div className="flex-1">
        <h3 className="font-medium">{recording.title}</h3>
        <p className="text-sm text-gray-500">
          {formatDuration(recording.duration)} -{" "}
          {format(new Date(recording.created_at), "dd/MM/yyyy", { locale: fr })}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPlayToggle(recording.id, recording.file_path)}
        >
          {playingId === recording.id ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDelete(recording.id, recording.file_path)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default RecordingItem;