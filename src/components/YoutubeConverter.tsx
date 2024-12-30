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

  const validateYoutubeUrl = (url: string) => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(url);
  };

  const handleConvert = async () => {
    if (!url) {
      toast({
        title: "URL manquante",
        description: "Veuillez entrer une URL YouTube",
        variant: "destructive",
      });
      return;
    }

    if (!validateYoutubeUrl(url)) {
      toast({
        title: "URL invalide",
        description: "Veuillez entrer une URL YouTube valide",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);
    try {
      console.log('Starting conversion for URL:', url);
      const { data, error } = await supabase.functions.invoke('convert-youtube', {
        body: { youtubeUrl: url }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }
      
      if (!data?.downloadUrl) {
        console.error('Invalid response:', data);
        if (data?.isRateLimit) {
          toast({
            title: "Service temporairement indisponible",
            description: "Le quota mensuel de conversions YouTube a été atteint. Veuillez réessayer le mois prochain ou contacter le support.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erreur de conversion",
            description: data?.error || "Une erreur est survenue lors de la conversion",
            variant: "destructive",
          });
        }
        return;
      }

      console.log('Conversion successful:', data);
      setConvertedFile({
        url: data.downloadUrl,
        title: data.title || 'YouTube conversion'
      });
      setShowSaveDialog(true);
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        title: "Erreur de conversion",
        description: error.message || "Une erreur est survenue lors de la conversion de la vidéo",
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

      console.log('Downloading file from URL:', convertedFile.url);
      const response = await fetch(convertedFile.url);
      if (!response.ok) throw new Error('Failed to download the file');
      
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'audio/mpeg' });

      console.log('Uploading file to Supabase Storage:', fileName);
      const { error: uploadError } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, file, {
          contentType: 'audio/mpeg'
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('recordings')
        .insert({
          title,
          file_path: fileName,
          file_size: file.size,
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
        description: error.message || "Une erreur est survenue lors de la sauvegarde",
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