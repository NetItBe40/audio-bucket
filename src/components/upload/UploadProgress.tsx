import { Progress } from "@/components/ui/progress";

interface UploadProgressProps {
  progress: number;
  isConverting: boolean;
  isUploading: boolean;
}

const UploadProgress = ({ progress, isConverting, isUploading }: UploadProgressProps) => {
  if (!isConverting && !isUploading) return null;

  return (
    <div className="mt-4 space-y-2">
      <Progress value={progress} className="w-full" />
      <div className="text-center text-sm text-gray-500">
        {isConverting ? "Conversion en cours..." : "Upload en cours..."}
        <div className="mt-1">
          {progress}% complété
        </div>
      </div>
    </div>
  );
};

export default UploadProgress;