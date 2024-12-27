import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast({
        title: "Enregistrement démarré",
        description: "Parlez maintenant...",
      });
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'accéder au microphone",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({
        title: "Enregistrement terminé",
        description: "Vous pouvez maintenant sauvegarder l'enregistrement",
      });
    }
  };

  const saveRecording = async () => {
    if (!audioBlob) return;

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Vous devez être connecté pour sauvegarder un enregistrement",
        });
        return;
      }

      const fileName = `recording-${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, audioBlob);

      if (error) throw error;

      const { error: dbError } = await supabase.from("recordings").insert({
        title: fileName,
        file_path: data.path,
        file_size: audioBlob.size,
        duration: 0, // We'll implement duration calculation later
        user_id: user.id // Add the user_id here
      });

      if (dbError) throw dbError;

      toast({
        title: "Succès",
        description: "Enregistrement sauvegardé avec succès",
      });
      setAudioBlob(null);
      
      // Rafraîchir la liste des enregistrements
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    } catch (error) {
      console.error("Error saving recording:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder l'enregistrement",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            className="bg-red-500 hover:bg-red-600"
          >
            <Mic className="mr-2" />
            Démarrer l'enregistrement
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            variant="destructive"
          >
            <Square className="mr-2" />
            Arrêter l'enregistrement
          </Button>
        )}
      </div>

      {audioBlob && (
        <div className="space-y-4">
          <audio
            src={URL.createObjectURL(audioBlob)}
            controls
            className="w-full"
          />
          <Button onClick={saveRecording} className="w-full">
            <Save className="mr-2" />
            Sauvegarder l'enregistrement
          </Button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;