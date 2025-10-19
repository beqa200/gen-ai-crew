import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Calendar, Tag, Bot, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  department_id: string;
  image_url: string | null;
  created_at: string;
}

interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

interface TaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate: () => void;
  departmentName?: string;
  projectDescription?: string;
  projectName?: string;
  allDepartments?: Array<{ id: string; name: string }>;
  allTasks?: Task[];
  taskDependencies?: TaskDependency[];
}

export function TaskDialog({
  task,
  open,
  onOpenChange,
  onTaskUpdate,
  departmentName,
  projectDescription,
  projectName,
  allDepartments,
  allTasks = [],
  taskDependencies = [],
}: TaskDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTask, setEditedTask] = useState<Task | null>(task);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Update editedTask when task prop changes
  useEffect(() => {
    setEditedTask(task);
    setIsEditing(false);
  }, [task]);

  // Load AI chat history when task changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!task?.id) return;

      const { data, error } = await supabase
        .from("task_ai_messages")
        .select("role, content")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading chat history:", error);
        return;
      }

      setAiMessages((data || []) as Array<{ role: "user" | "assistant"; content: string }>);
    };

    loadChatHistory();
  }, [task?.id]);

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

  const handleAiMessage = async () => {
    if (!aiInput.trim() || !displayTask || !task?.id) return;

    const userMessage = aiInput.trim();

    // Optimistically add user message to UI
    setAiMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setAiInput("");
    setIsAiLoading(true);

    try {
      // Save user message to database
      const { error: saveUserError } = await supabase.from("task_ai_messages").insert({
        task_id: task.id,
        role: "user",
        content: userMessage,
      });

      if (saveUserError) throw saveUserError;

      // Get blocker tasks (incomplete dependencies)
      const blockers = taskDependencies
        .filter(dep => dep.task_id === task.id)
        .map(dep => allTasks.find(t => t.id === dep.depends_on_task_id))
        .filter(t => t && t.status !== "completed");

      // Get AI response with chat history and blocker info
      const { data, error } = await supabase.functions.invoke("task-assistant", {
        body: {
          message: userMessage,
          taskContext: {
            title: displayTask.title,
            description: displayTask.description,
            status: displayTask.status,
            departmentName: departmentName,
            projectDescription: projectDescription,
            projectName: projectName,
            allDepartments: allDepartments?.map((d) => d.name),
            blockers: blockers.map(b => ({
              title: b?.title,
              status: b?.status,
            })),
          },
          chatHistory: aiMessages,
        },
      });

      if (error) throw error;

      // Add assistant message to UI
      setAiMessages((prev) => [...prev, { role: "assistant", content: data.message }]);

      // Save assistant message to database
      const { error: saveAssistantError } = await supabase.from("task_ai_messages").insert({
        task_id: task.id,
        role: "assistant",
        content: data.message,
      });

      if (saveAssistantError) throw saveAssistantError;
    } catch (error) {
      console.error("Error calling AI assistant:", error);
      toast.error("Failed to get AI response");
      // Reload messages from database to sync state
      const { data } = await supabase
        .from("task_ai_messages")
        .select("role, content")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });

      if (data) setAiMessages(data as Array<{ role: "user" | "assistant"; content: string }>);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600 text-white hover:bg-green-700";
      case "in_progress":
        return "bg-blue-600 text-white hover:bg-blue-700";
      default:
        return "bg-gray-600 text-white hover:bg-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ").toUpperCase();
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

  // Get blocker tasks for this task
  const blockerTaskIds = taskDependencies
    .filter(dep => dep.task_id === displayTask?.id)
    .map(dep => dep.depends_on_task_id);
  
  const blockerTasks = allTasks.filter(t => blockerTaskIds.includes(t.id));
  const hasIncompleteBlockers = blockerTasks.some(t => t.status !== "completed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">{isEditing ? "Edit Task" : "Task Details"}</DialogTitle>
          <DialogDescription>
            {departmentName && (
              <div className="flex items-center gap-2 mt-2">
                <Tag className="w-4 h-4" />
                <span>{departmentName}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 overflow-hidden">
          <div className={`space-y-6 py-4 overflow-y-auto ${showAI ? "w-1/2" : "w-full"}`}>
            {displayTask?.image_url && (
              <div className="w-full h-64 rounded-lg overflow-hidden">
                <img src={displayTask.image_url} alt={displayTask.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                {isEditing ? (
                  <Input
                    id="title"
                    value={editedTask?.title || ""}
                    onChange={(e) => setEditedTask(editedTask ? { ...editedTask, title: e.target.value } : null)}
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
                    onValueChange={(value) => setEditedTask(editedTask ? { ...editedTask, status: value } : null)}
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
                  <div className="pt-1">
                    <Badge className={getStatusColor(displayTask?.status || "pending")}>
                      {getStatusLabel(displayTask?.status || "pending")}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                {isEditing ? (
                  <Textarea
                    id="description"
                    value={editedTask?.description || ""}
                    onChange={(e) => setEditedTask(editedTask ? { ...editedTask, description: e.target.value } : null)}
                    placeholder="Task description"
                    className="min-h-[150px]"
                  />
                ) : (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {displayTask?.description}
                  </p>
                )}
              </div>

              {!isEditing && blockerTasks.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Blocked By</Label>
                  <div className="space-y-2">
                    {blockerTasks.map(blocker => (
                      <div key={blocker.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{blocker.title}</span>
                        </div>
                        <Badge className={getStatusColor(blocker.status)}>
                          {getStatusLabel(blocker.status)}
                        </Badge>
                      </div>
                    ))}
                    {hasIncompleteBlockers && (
                      <p className="text-xs text-muted-foreground">
                        ⚠️ This task is blocked by incomplete tasks. Complete the blockers first.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
                  <Calendar className="w-4 h-4" />
                  <span>Created on {formatDate(displayTask?.created_at || "")}</span>
                </div>
              )}
            </div>
          </div>

          {showAI && (
            <div className="w-1/2 border-l pl-4 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5" />
                <h3 className="font-semibold">AI Assistant</h3>
              </div>

              {hasIncompleteBlockers ? (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div className="space-y-3 max-w-sm">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Bot className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h4 className="font-semibold">AI Assistant Unavailable</h4>
                    <p className="text-sm text-muted-foreground">
                      This task is blocked by incomplete dependencies. Complete the blocking tasks first before using the AI assistant.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 pr-4 mb-4">
                    <div className="space-y-4">
                      {aiMessages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Ask me anything about this task! I can help break it down, suggest approaches, or answer
                          questions.
                        </p>
                      ) : (
                        aiMessages.map((msg, idx) => (
                          <div key={idx} className={`p-3 rounded-lg ${msg.role === "user" ? "bg-primary/10" : "bg-muted"}`}>
                            <p className="text-sm font-medium mb-1">{msg.role === "user" ? "You" : "AI Assistant"}</p>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))
                      )}
                      {isAiLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAiMessage()}
                      placeholder="Ask the AI assistant..."
                      disabled={isAiLoading}
                    />
                    <Button onClick={handleAiMessage} disabled={isAiLoading || !aiInput.trim()} size="icon">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
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
              <Button variant="outline" onClick={() => setShowAI(!showAI)}>
                <Bot className="w-4 h-4 mr-2" />
                {showAI ? "Hide" : "Show"} AI Assistant
              </Button>
              <Button onClick={handleEdit}>Edit Task</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
