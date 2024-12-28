import { Tables } from "@/integrations/supabase/types";

type TranscriptionProps = {
  transcription: Tables<"transcriptions">;
};

export const TranscriptionDisplay = ({ transcription }: TranscriptionProps) => {
  if (transcription.status === "completed") {
    if (transcription.speaker_detection && transcription.speaker_labels) {
      // Display text with speaker labels
      const utterances = transcription.speaker_labels as Array<{
        speaker: string;
        text: string;
      }>;

      return (
        <div className="bg-gray-50 p-2 sm:p-3 rounded-md text-sm">
          <p className="text-gray-600 mb-1 sm:mb-2">
            Transcription ({transcription.language})
          </p>
          <div className="space-y-2">
            {utterances.map((utterance, index) => (
              <div key={index} className="break-words">
                <span className="font-medium text-indigo-600">
                  {utterance.speaker}:
                </span>{" "}
                {utterance.text}
              </div>
            ))}
          </div>
        </div>
      );
    }

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