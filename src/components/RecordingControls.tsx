import { Button } from "@/components/ui/button";
import { Play, Square, MessageSquare, Loader } from "lucide-react";

type RecordingControlsProps = {
  isPlaying: boolean;
  isTranscribing: boolean;
  onPlayToggle: () => void;
  onTranscribe: () => void;
};

export const RecordingControls = ({
  isPlaying,
  isTranscribing,
  onPlayToggle,
  onTranscribe,
}: RecordingControlsProps) => {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="icon" onClick={onPlayToggle}>
        {isPlaying ? (
          <Square className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onTranscribe}
        disabled={isTranscribing}
      >
        {isTranscribing ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};