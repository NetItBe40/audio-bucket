import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useState, useRef } from "react";
import RecordingItem from "./RecordingItem";

const RecordingsList = () => {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: recordings, isLoading, refetch } = useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string, filePath: string) => {
    try {
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }

      const { error: storageError } = await supabase.storage
        .from("audio-recordings")
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("recordings")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      toast({
        title: "Succès",
        description: "Enregistrement supprimé avec succès",
      });

      refetch();
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'enregistrement",
      });
    }
  };

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

  if (isLoading) {
    return <div className="text-center">Chargement...</div>;
  }

  if (!recordings?.length) {
    return (
      <div className="text-center text-gray-500">
        Aucun enregistrement trouvé
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recordings.map((recording) => (
        <RecordingItem
          key={recording.id}
          recording={recording}
          playingId={playingId}
          onPlayToggle={handlePlayToggle}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default RecordingsList;