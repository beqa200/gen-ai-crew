import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StartTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  taskTitle: string;
  isStarting?: boolean;
}

export function StartTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
  isStarting = false,
}: StartTaskDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start Working on Task?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want AI to start working on <strong>"{taskTitle}"</strong>? 
            The task status will be changed to "In Progress".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isStarting}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isStarting ? "Starting..." : "Yes, Start Task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
