import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, taskContext, chatHistory } = await req.json();
    console.log('Task context received:', JSON.stringify(taskContext, null, 2));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if task has incomplete blockers
    const hasBlockers = taskContext.blockers && taskContext.blockers.length > 0;
    const blockersList = hasBlockers 
      ? taskContext.blockers.map((b: any) => `  - "${b.title}" (Status: ${b.status})`).join('\n')
      : '';

    const systemPrompt = `You are a helpful AI assistant for a task management system helping with a startup project.

PROJECT: ${taskContext.projectName || 'Untitled Project'}
${taskContext.projectDescription ? `\nPROJECT DESCRIPTION:\n${taskContext.projectDescription}\n` : ''}
${taskContext.allDepartments?.length > 0 ? `\nPROJECT DEPARTMENTS: ${taskContext.allDepartments.join(', ')}\n` : ''}
CURRENT TASK YOU'RE HELPING WITH:
- Title: ${taskContext.title}
- Description: ${taskContext.description}
- Status: ${taskContext.status}
- Department: ${taskContext.departmentName || 'Unknown'}

${hasBlockers ? `⚠️ CRITICAL - TASK IS BLOCKED:
This task depends on the following incomplete tasks. The user CANNOT start this task until these blockers are completed:
${blockersList}

You MUST inform the user that this task is blocked and they need to complete the blocker tasks first. Do not provide detailed help on this task until the blockers are resolved. Instead, guide them to focus on the blocking tasks.
` : ''}
IMPORTANT CONTEXT:
- You have full access to the conversation history
- When users ask about previous messages, refer to the chat history
- You understand the ENTIRE project context, not just this single task
- Consider how this task fits into the overall project goals and other departments

YOUR ROLE:
${hasBlockers ? '- FIRST: Alert the user that this task is blocked by incomplete dependencies' : ''}
${hasBlockers ? '- Suggest they complete the blocker tasks before starting this one' : ''}
- Break down this task into actionable steps
- Suggest improvements that align with the overall project vision
- Answer questions about this task in the context of the full startup project
- Provide relevant tips considering all project departments
- Reference previous conversation when relevant

Keep responses concise and actionable.`;

    // Build messages array with chat history
    const messages = [
      { role: "system", content: systemPrompt },
      ...(chatHistory || []),
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    return new Response(JSON.stringify({ message: assistantMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in task-assistant function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
