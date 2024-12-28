import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";

type TranscriptionProps = {
  transcription: Tables<"transcriptions">;
};

export const TranscriptionDisplay = ({ transcription }: TranscriptionProps) => {
  if (transcription.status === "completed") {
    const hasUtterances = transcription.speaker_detection && 
      transcription.speaker_labels && 
      Array.isArray(transcription.speaker_labels) && 
      transcription.speaker_labels.length > 0;

    const hasEntities = transcription.entity_detection && 
      transcription.entities && 
      Array.isArray(transcription.entities) && 
      transcription.entities.length > 0;

    return (
      <div className="bg-gray-50 p-2 sm:p-3 rounded-md text-sm space-y-4">
        <p className="text-gray-600 mb-1 sm:mb-2">
          Transcription ({transcription.language})
        </p>
        
        {hasUtterances ? (
          // Affichage avec détection des intervenants
          <div className="space-y-2">
            {(transcription.speaker_labels as Array<{
              speaker: string;
              text: string;
            }>).map((utterance, index) => (
              <div key={index} className="break-words">
                <span className="font-medium text-indigo-600">
                  {utterance.speaker}:
                </span>{" "}
                {utterance.text}
              </div>
            ))}
          </div>
        ) : (
          // Affichage standard
          <p className="break-words">{transcription.text}</p>
        )}

        {/* Affichage des entités détectées */}
        {hasEntities && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Entités détectées :
            </p>
            <div className="flex flex-wrap gap-2">
              {(transcription.entities as Array<{
                entity_type: string;
                text: string;
              }>).map((entity, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs"
                >
                  {entity.text} ({entity.entity_type})
                </Badge>
              ))}
            </div>
          </div>
        )}
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