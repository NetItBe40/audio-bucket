import { Tables } from "@/integrations/supabase/types";

type TranscriptionProps = {
  transcription: Tables<"transcriptions">;
};

export const TranscriptionDisplay = ({ transcription }: TranscriptionProps) => {
  if (transcription.status === "completed") {
    return (
      <div className="bg-gray-50 p-2 sm:p-3 rounded-md text-sm">
        <p className="text-gray-600 mb-1 sm:mb-2">
          Transcription ({transcription.language})
        </p>
        <p className="break-words">{transcription.text}</p>
      </div>
    );
  }

  if (transcription.status === "error") {
    return (
      <div className="bg-gray-50 p-2 sm:p-3 rounded-md">
        <p className="text-sm text-red-600">
          Une erreur est survenue lors de la transcription
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-2 sm:p-3 rounded-md">
      <p className="text-sm text-gray-600">Transcription en cours...</p>
    </div>
  );
};