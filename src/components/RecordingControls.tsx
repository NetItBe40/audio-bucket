import { Button } from "@/components/ui/button";
import { Play, Square, MessageSquare, FileText, Copy, Eye, EyeOff, Download, Trash2, Loader } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type RecordingControlsProps = {
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

export const RecordingControls = ({
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
}: RecordingControlsProps) => {
  const hasTranscription = transcription?.status === "completed";
  const showTranscriptionControls = hasTranscription && transcription.text;

  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="icon" onClick={onPlayToggle}>
        {isPlaying ? (
          <Square className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onTranscribe}
        disabled={isTranscribing || hasTranscription}
      >
        {isTranscribing ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : hasTranscription ? (
          <FileText className="h-4 w-4" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
      </Button>

      {showTranscriptionControls && (
        <>
          <Button variant="ghost" size="icon" onClick={onCopyTranscription}>
            <Copy className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" onClick={onToggleTranscriptionVisibility}>
            {isTranscriptionVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={onExportTranscription}>
            <Download className="h-4 w-4" />
          </Button>
        </>
      )}

      <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};