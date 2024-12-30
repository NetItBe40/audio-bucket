import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import SaveDialog from "./SaveDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const YoutubeConverter = () => {
  const [url, setUrl] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [convertedFile, setConvertedFile] = useState<{ url: string; title: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConvert = async () => {
    if (!url) return;

    setIsConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke('convert-youtube', {
        body: { youtubeUrl: url }
      });

      if (error) throw error;
      if (!data.downloadUrl) throw new Error('No download URL received');

      // Store the download URL and title
      setConvertedFile({
        url: data.downloadUrl,
        title: data.title || 'YouTube conversion'
      });
      setShowSaveDialog(true);
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        title: "Erreur de conversion",
        description: "Une erreur est survenue lors de la conversion de la vidéo",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleSave = async (title: string) => {
    if (!convertedFile) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non authentifié");

      const timestamp = Date.now();
      const fileName = `${userData.user.id}/${timestamp}-${title}.mp3`;

      // Download the file from the URL
      const response = await fetch(convertedFile.url);
      if (!response.ok) throw new Error('Failed to download the file');
      
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, blob, {
          contentType: 'audio/mpeg'
        });

      if (uploadError) throw uploadError;

      // Create recording entry
      const { error: insertError } = await supabase
        .from('recordings')
        .insert({
          title,
          file_path: fileName,
          file_size: blob.size,
          user_id: userData.user.id,
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      setShowSaveDialog(false);
      setConvertedFile(null);
      setUrl("");
      
      toast({
        title: "Succès",
        description: "La vidéo a été convertie et sauvegardée avec succès",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Convertir une vidéo YouTube</h3>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Collez l'URL YouTube ici"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isConverting}
          />
          <Button 
            onClick={handleConvert}
            disabled={!url || isConverting}
          >
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conversion...
              </>
            ) : (
              "Convertir"
            )}
          </Button>
        </div>
      </div>

      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />
    </Card>
  );
};

export default YoutubeConverter;