import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import AudioPreview from "./AudioPreview";
import RecordButton from "./RecordButton";
import SaveDialog from "./SaveDialog";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        
        // Attendre que l'audio soit chargé avant de définir l'URL
        const audio = new Audio(url);
        await new Promise((resolve) => {
          audio.addEventListener('loadedmetadata', () => {
            setAudioDuration(Math.round(audio.duration));
            resolve(null);
          });
        });
        
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Erreur",
        description:
          "Impossible d'accéder au microphone. Veuillez vérifier les permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSave = async (title: string) => {
    if (!audioUrl) return;

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      const blob = await fetch(audioUrl).then((r) => r.blob());
      const fileName = `${user.id}/${Date.now()}.webm`;

      console.log("Saving audio with duration:", audioDuration); // Debug log

      const { error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("recordings").insert({
        title,
        file_path: fileName,
        file_size: blob.size,
        duration: audioDuration,
        user_id: user.id,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      setShowSaveDialog(false);
      setAudioUrl(null);
      setAudioDuration(0);
      toast({
        title: "Succès",
        description: "L'enregistrement a été sauvegardé avec succès.",
      });
    } catch (error) {
      console.error("Error saving recording:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive",
      });
    }
  };

  const handleDiscard = () => {
    setAudioUrl(null);
    setAudioDuration(0);
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm">
      <RecordButton
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
      />
      {audioUrl && (
        <AudioPreview
          audioUrl={audioUrl}
          onSave={() => setShowSaveDialog(true)}
          onDiscard={handleDiscard}
        />
      )}
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />
    </div>
  );
};

export default AudioRecorder;