import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useAudioPlayer = () => {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = async (id: string, filePath: string) => {
    try {
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      if (playingId && audioRef.current) {
        audioRef.current.pause();
      }

      const { data, error } = await supabase.storage
        .from("audio-recordings")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      const audio = new Audio(data.signedUrl);
      audioRef.current = audio;

      audio.play();
      setPlayingId(id);

      audio.onended = () => {
        setPlayingId(null);
      };
    } catch (error) {
      console.error("Error playing recording:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de lire l'enregistrement",
      });
    }
  };

  return {
    playingId,
    handlePlayToggle,
  };
};