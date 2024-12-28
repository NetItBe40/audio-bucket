import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Square, Trash2, MessageSquare, Loader } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useRef } from "react";

const RecordingsList = () => {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<string | null>(null);
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePlayToggle(recording.id, recording.file_path)}
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
                onClick={() => handleTranscribe(recording.id)}
                disabled={recording.transcriptions?.[0]?.status === "processing"}
              >
                {recording.transcriptions?.[0]?.status === "processing" ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDelete(recording.id, recording.file_path)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {recording.transcriptions?.[0] && (
            <div className="bg-gray-50 p-3 rounded-md">
              {recording.transcriptions[0].status === "completed" ? (
                <>
                  <p className="text-sm text-gray-600 mb-2">
                    Transcription ({recording.transcriptions[0].language})
                  </p>
                  <p className="text-sm">{recording.transcriptions[0].text}</p>
                </>
              ) : recording.transcriptions[0].status === "error" ? (
                <p className="text-sm text-red-600">
                  Une erreur est survenue lors de la transcription
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Transcription en cours...
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RecordingsList;