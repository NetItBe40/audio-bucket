import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

interface RecordButtonProps {
  isRecording: boolean;
  onToggleRecording: () => void;
}

const RecordButton = ({ isRecording, onToggleRecording }: RecordButtonProps) => {
  return (
    <Button
      onClick={onToggleRecording}
      variant={isRecording ? "destructive" : "default"}
      className="w-full"
    >
      {isRecording ? (
        <>
          <Square className="h-4 w-4 mr-2" />
          Arrêter l'enregistrement
        </>
      ) : (
        <>
          <Mic className="h-4 w-4 mr-2" />
          Commencer l'enregistrement
        </>
      )}
    </Button>
  );
};

export default RecordButton;