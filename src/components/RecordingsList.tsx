import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Square, Trash2, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
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
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string, filePath: string) => {
    try {
      // Si on supprime l'enregistrement en cours de lecture, on l'arrête
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
      // Si on clique sur l'enregistrement en cours de lecture, on l'arrête
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      // Si un autre enregistrement est en cours de lecture, on l'arrête
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

      // Quand l'audio se termine
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

  const handleDownload = async (filePath: string, title: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("audio-recordings")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      // Créer un lien temporaire et déclencher le téléchargement
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = `${title}.webm`; // Utiliser le titre comme nom de fichier
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Succès",
        description: "Le téléchargement a démarré",
      });
    } catch (error) {
      console.error("Error downloading recording:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de télécharger l'enregistrement",
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
        <div
          key={recording.id}
          className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between"
        >
          <div className="flex-1">
            <h3 className="font-medium">{recording.title}</h3>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(recording.created_at), {
                addSuffix: true,
                locale: fr,
              })}
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
              onClick={() => handleDownload(recording.file_path, recording.title)}
            >
              <Download className="h-4 w-4" />
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
      ))}
    </div>
  );
};

export default RecordingsList;
