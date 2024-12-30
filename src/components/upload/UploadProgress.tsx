import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface UploadProgressProps {
  progress: number;
  isConverting: boolean;
  isUploading: boolean;
}

const UploadProgress = ({ progress, isConverting, isUploading }: UploadProgressProps) => {
  if (!isConverting && !isUploading) return null;

  const getStatusMessage = () => {
    if (isUploading) {
      if (progress === 0) return "Préparation de l'upload...";
      if (progress === 100) return "Finalisation de l'upload...";
      return "Upload en cours...";
    }
    if (isConverting) {
      if (progress === 0) return "Démarrage de la conversion...";
      if (progress === 100) return "Finalisation de la conversion...";
      return "Conversion en cours...";
    }
    return "";
  };

  return (
    <div className="mt-4 space-y-4">
      <Progress value={progress} className="w-full" />
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{getStatusMessage()}</span>
        </div>
        <div className="text-sm text-gray-500">
          {progress}% complété
        </div>
      </div>
    </div>
  );
};

export default UploadProgress;