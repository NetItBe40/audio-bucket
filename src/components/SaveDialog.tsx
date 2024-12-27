import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}

const SaveDialog = ({ isOpen, onClose, onSave }: SaveDialogProps) => {
  const [title, setTitle] = useState("");

  const handleSave = () => {
    onSave(title);
    setTitle("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sauvegarder l'enregistrement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mon enregistrement"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!title}>
              Sauvegarder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveDialog;