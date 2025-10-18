import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Calendar, Tag } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  department_id: string;
  image_url: string | null;
  created_at: string;
}

interface TaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate: () => void;
  departmentName?: string;
}

export function TaskDialog({ task, open, onOpenChange, onTaskUpdate, departmentName }: TaskDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTask, setEditedTask] = useState<Task | null>(task);

  const handleEdit = () => {
    setEditedTask(task);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editedTask) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editedTask.title,
          description: editedTask.description,
          status: editedTask.status,
        })
        .eq("id", editedTask.id);

      if (error) throw error;

      toast.success("Task updated successfully");
      setIsEditing(false);
      onTaskUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!task && !editedTask) return null;

  const displayTask = editedTask || task;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditing ? "Edit Task" : "Task Details"}
          </DialogTitle>
          <DialogDescription>
            {departmentName && (
              <div className="flex items-center gap-2 mt-2">
                <Tag className="w-4 h-4" />
                <span>{departmentName}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {displayTask?.image_url && (
            <div className="w-full h-64 rounded-lg overflow-hidden">
              <img
                src={displayTask.image_url}
                alt={displayTask.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              {isEditing ? (
                <Input
                  id="title"
                  value={editedTask?.title || ""}
                  onChange={(e) =>
                    setEditedTask(editedTask ? { ...editedTask, title: e.target.value } : null)
                  }
                  placeholder="Task title"
                />
              ) : (
                <h3 className="text-xl font-semibold">{displayTask?.title}</h3>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              {isEditing ? (
                <Select
                  value={editedTask?.status || "pending"}
                  onValueChange={(value) =>
                    setEditedTask(editedTask ? { ...editedTask, status: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={getStatusColor(displayTask?.status || "pending")}>
                  {displayTask?.status.replace("_", " ")}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {isEditing ? (
                <Textarea
                  id="description"
                  value={editedTask?.description || ""}
                  onChange={(e) =>
                    setEditedTask(editedTask ? { ...editedTask, description: e.target.value } : null)
                  }
                  placeholder="Task description"
                  className="min-h-[150px]"
                />
              ) : (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {displayTask?.description}
                </p>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
                <Calendar className="w-4 h-4" />
                <span>Created on {formatDate(displayTask?.created_at || "")}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleEdit}>Edit Task</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
