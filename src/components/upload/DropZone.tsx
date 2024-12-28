import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

interface DropZoneProps {
  onFileSelect: (file: File) => void;
}

const DropZone = ({ onFileSelect }: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    validateAndSelectFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndSelectFile(file);
    
    // Réinitialiser la valeur de l'input file
    if (e.target) {
      e.target.value = '';
    }
  };

  const validateAndSelectFile = (file: File | undefined) => {
    if (file && file.type.startsWith("audio/")) {
      onFileSelect(file);
    } else {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier audio valide.",
        variant: "destructive",
      });
    }
  };

  return (
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
  );
};

export default DropZone;