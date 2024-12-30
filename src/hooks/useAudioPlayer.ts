import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useAudioPlayer = () => {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = async (id: string, filePath: string) => {
    try {
      // If already playing this audio, stop it
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      // If playing something else, stop it first
      if (playingId && audioRef.current) {
        audioRef.current.pause();
      }

      console.log('Getting signed URL for:', filePath);
      
      // Get a signed URL with a longer expiration (1 hour)
      const { data, error } = await supabase.storage
        .from("audio-recordings")
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error('Error getting signed URL:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      console.log('Successfully got signed URL');

      // Create and play the audio
      const audio = new Audio(data.signedUrl);
      audioRef.current = audio;

      // Set up event listeners before playing
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setPlayingId(null);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de lire l'enregistrement",
        });
      });

      audio.addEventListener('ended', () => {
        setPlayingId(null);
      });

      // Start playing
      const playPromise = audio.play();
      setPlayingId(id);

      // Handle play promise rejection
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('Playback failed:', error);
          setPlayingId(null);
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "La lecture a échoué",
          });
        });
      }

    } catch (error) {
      console.error("Error playing recording:", error);
      setPlayingId(null);
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