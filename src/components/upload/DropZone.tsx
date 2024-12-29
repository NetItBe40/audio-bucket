import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";

// Liste des formats de fichiers acceptés
const ACCEPTED_AUDIO_FORMATS = [
  ".3ga", ".8svx", ".aac", ".ac3", ".aif", ".aiff", ".alac", ".amr", 
  ".ape", ".au", ".dss", ".flac", ".flv", ".m4a", ".m4b", ".m4p", 
  ".m4r", ".mp3", ".mpga", ".ogg", ".oga", ".mogg", ".opus", ".qcp", 
  ".tta", ".voc", ".wav", ".wma", ".wv"
];

const ACCEPTED_VIDEO_FORMATS = [
  ".webm", ".mts", ".m2ts", ".ts", ".mov", ".mp2", ".mp4", ".m4p", 
  ".m4v", ".mxf"
];

// Combine tous les formats en un seul objet pour react-dropzone
const ACCEPTED_FORMATS = {
  'audio/*': ACCEPTED_AUDIO_FORMATS,
  'video/*': ACCEPTED_VIDEO_FORMATS
};

type DropZoneProps = {
  onFileSelect: (file: File) => void;
};

const DropZone = ({ onFileSelect }: DropZoneProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: 1,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-gray-300 hover:border-primary"
        }`}
    >
      <input {...getInputProps()} />
      <Upload className="w-10 h-10 mx-auto mb-4 text-gray-400" />
      {isDragActive ? (
        <p className="text-sm text-gray-600">Déposez le fichier ici...</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Glissez-déposez un fichier audio ou vidéo, ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-gray-500">
            Formats acceptés : {ACCEPTED_AUDIO_FORMATS.join(", ")}, {ACCEPTED_VIDEO_FORMATS.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
};

export default DropZone;