import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type TranscribeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speakerDetection: boolean;
  onSpeakerDetectionChange: (checked: boolean) => void;
  entityDetection: boolean;
  onEntityDetectionChange: (checked: boolean) => void;
  onConfirm: () => void;
};

export const TranscribeDialog = ({
  open,
  onOpenChange,
  speakerDetection,
  onSpeakerDetectionChange,
  entityDetection,
  onEntityDetectionChange,
  onConfirm,
}: TranscribeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Options de transcription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="speaker-detection"
              checked={speakerDetection}
              onCheckedChange={onSpeakerDetectionChange}
            />
            <Label htmlFor="speaker-detection">
              Activer la détection des intervenants
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="entity-detection"
              checked={entityDetection}
              onCheckedChange={onEntityDetectionChange}
            />
            <Label htmlFor="entity-detection">
              Activer la détection des entités
            </Label>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
            onClick={onConfirm}
          >
            Démarrer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};