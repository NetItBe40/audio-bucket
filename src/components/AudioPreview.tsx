import { Button } from "@/components/ui/button";
import { Play, Save, X } from "lucide-react";
import { useState } from "react";

interface AudioPreviewProps {
  audioUrl: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

const AudioPreview = ({ audioUrl, onSave, onDiscard }: AudioPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const handlePlay = () => {
    if (audioUrl && !isPlaying) {
      const audio = new Audio(audioUrl);
      audioRef[1](audio);
      audio.play();
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handlePlay} variant="outline" className="flex-1">
          <Play className="h-4 w-4 mr-2" />
          Écouter
        </Button>
        <Button onClick={onSave} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Sauvegarder
        </Button>
        <Button onClick={onDiscard} variant="destructive" className="flex-1">
          <X className="h-4 w-4 mr-2" />
          Annuler
        </Button>
      </div>
    </div>
  );
};

export default AudioPreview;