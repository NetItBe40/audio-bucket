import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import SaveDialog from "./SaveDialog";

const AudioUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processAudioFile = async (file: File) => {
    if (file && file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      
      try {
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => {
            const duration = Math.round(audio.duration);
            console.log("Audio duration calculated:", duration);
            setAudioDuration(duration);
            resolve();
          });
          
          audio.addEventListener('error', (e) => {
            console.error("Error loading audio:", e);
            reject(new Error("Failed to load audio"));
          });
        });
        
        setCurrentFile(file);
        setShowSaveDialog(true);
      } catch (error) {
        console.error("Error processing audio file:", error);
        toast({
          title: "Erreur",
          description: "Impossible de traiter le fichier audio.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier audio valide.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processAudioFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAudioFile(file);
    }
  };

  const handleSave = async (title: string) => {
    if (!currentFile) return;

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      const fileName = `${user.id}/${Date.now()}.${currentFile.name.split('.').pop()}`;

      console.log("Saving audio with duration:", audioDuration);

      const { error: uploadError } = await supabase.storage
        .from("audio-recordings")
        .upload(fileName, currentFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("recordings").insert({
        title,
        file_path: fileName,
        file_size: currentFile.size,
        duration: audioDuration,
        user_id: user.id,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      setShowSaveDialog(false);
      setCurrentFile(null);
      setAudioDuration(0);
      toast({
        title: "Succès",
        description: "Le fichier a été importé avec succès.",
      });
    } catch (error) {
      console.error("Error saving file:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'importation.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging ? "border-primary bg-primary/10" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600">
          Glissez-déposez un fichier audio ou cliquez pour sélectionner
        </p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept="audio/*"
          onChange={handleFileSelect}
        />
      </div>
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />
    </>
  );
};

export default AudioUpload;