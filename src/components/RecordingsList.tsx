import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useRef, useEffect } from "react";
import { TranscriptionDisplay } from "./TranscriptionDisplay";
import { RecordingControls } from "./RecordingControls";

const RecordingsList = () => {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: recordings, isLoading, refetch } = useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recordings")
        .select(`
          *,
          transcriptions (
            status,
            text,
            language
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Polling pour les transcriptions en cours
  useEffect(() => {
    if (transcribingIds.size === 0) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("transcriptions")
        .select("recording_id, status")
        .in(
          "recording_id",
          Array.from(transcribingIds)
        );

      if (data) {
        const completedIds = data
          .filter(t => t.status !== "processing")
          .map(t => t.recording_id);

        if (completedIds.length > 0) {
          setTranscribingIds(prev => {
            const next = new Set(prev);
            completedIds.forEach(id => next.delete(id));
            return next;
          });
          refetch();
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [transcribingIds, refetch]);

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

  const handleTranscribe = async (id: string) => {
    try {
      setTranscribingIds(prev => new Set(prev).add(id));
      
      const { error } = await supabase.functions.invoke("transcribe", {
        body: { recordingId: id },
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La transcription a démarré",
      });

      refetch();
    } catch (error) {
      console.error("Error starting transcription:", error);
      setTranscribingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de démarrer la transcription",
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

  const formatDuration = (duration: number | null) => {
    if (!duration) return "Durée inconnue";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {recordings.map((recording) => (
        <div
          key={recording.id}
          className="bg-white p-4 rounded-lg shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium">{recording.title}</h3>
              <p className="text-sm text-gray-500">
                {formatDuration(recording.duration)} - {format(new Date(recording.created_at), 'dd/MM/yyyy', { locale: fr })}
              </p>
            </div>
            <RecordingControls
              isPlaying={playingId === recording.id}
              isTranscribing={transcribingIds.has(recording.id)}
              onPlayToggle={() => handlePlayToggle(recording.id, recording.file_path)}
              onTranscribe={() => handleTranscribe(recording.id)}
              onDelete={() => handleDelete(recording.id, recording.file_path)}
            />
          </div>

          {recording.transcriptions?.[0] && (
            <TranscriptionDisplay transcription={recording.transcriptions[0]} />
          )}
        </div>
      ))}
    </div>
  );
};

export default RecordingsList;