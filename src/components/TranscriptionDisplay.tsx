import { Tables } from "@/integrations/supabase/types";

type TranscriptionProps = {
  transcription: Tables<"transcriptions">;
};

export const TranscriptionDisplay = ({ transcription }: TranscriptionProps) => {
  if (transcription.status === "completed") {
    return (
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-sm text-gray-600 mb-2">
          Transcription ({transcription.language})
        </p>
        <p className="text-sm">{transcription.text}</p>
      </div>
    );
  }

  if (transcription.status === "error") {
    return (
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-sm text-red-600">
          Une erreur est survenue lors de la transcription
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-3 rounded-md">
      <p className="text-sm text-gray-600">Transcription en cours...</p>
    </div>
  );
};