import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { RecordingItem } from "./recording/RecordingItem";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useTranscription } from "@/hooks/useTranscription";
import { useRecordingDeletion } from "@/hooks/useRecordingDeletion";
import { useToast } from "@/components/ui/use-toast";

const RecordingsList = () => {
  const { toast } = useToast();
  const { playingId, handlePlayToggle } = useAudioPlayer();
  const { data: recordings, isLoading, refetch } = useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recordings")
        .select(`
          *,
          transcriptions (
            id,
            recording_id,
            status,
            text,
            language,
            speaker_detection,
            speaker_labels,
            entity_detection,
            entities,
            created_at,
            updated_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { transcribingIds, setTranscribingIds, handleTranscribe } = useTranscription(refetch);
  const { handleDelete } = useRecordingDeletion(refetch);

  // Polling pour les transcriptions en cours
  useEffect(() => {
    if (transcribingIds.size === 0) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("transcriptions")
        .select("recording_id, status")
        .in("recording_id", Array.from(transcribingIds));

      if (data) {
        const completedIds = data
          .filter((t) => t.status !== "processing")
          .map((t) => t.recording_id);

        if (completedIds.length > 0) {
          setTranscribingIds((prev) => {
            const next = new Set(prev);
            completedIds.forEach((id) => next.delete(id));
            return next;
          });
          
          refetch();
          completedIds.forEach(() => {
            toast({
              title: "Transcription terminée",
              description: "Les informations ont été mises à jour",
            });
          });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [transcribingIds, refetch, toast, setTranscribingIds]);

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
          isPlaying={playingId === recording.id}
          isTranscribing={transcribingIds.has(recording.id)}
          onPlayToggle={() => handlePlayToggle(recording.id, recording.file_path)}
          onTranscribe={() => handleTranscribe(recording.id)}
          onDelete={() => handleDelete(recording.id, recording.file_path)}
        />
      ))}
    </div>
  );
};

export default RecordingsList;