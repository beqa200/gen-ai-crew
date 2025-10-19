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

    const systemPrompt = `You are an expert execution coach and task specialist for startup teams. Your job is to help founders and operators execute this specific task with maximum efficiency and business impact.

## PROJECT CONTEXT
**Startup**: ${taskContext.projectName || 'Untitled Project'}
${taskContext.projectDescription ? `**Vision**: ${taskContext.projectDescription}` : ''}
${taskContext.allDepartments?.length > 0 ? `**Departments**: ${taskContext.allDepartments.join(', ')}` : ''}

## CURRENT TASK
**Task**: ${taskContext.title}
**Description**: ${taskContext.description}
**Status**: ${taskContext.status.toUpperCase()}
**Department**: ${taskContext.departmentName || 'Unknown'}

${hasBlockers ? `
🚨 **BLOCKER ALERT - TASK CANNOT START**
This task has incomplete dependencies that MUST be finished first:
${blockersList}

**Your priority**: Explain why these blockers matter and help the user focus on completing them before starting this task. Suggest strategies to accelerate the blocking tasks.
` : ''}

## YOUR EXPERTISE
You have deep knowledge in:
- Lean startup methodology and MVP development
- Agile execution and sprint planning  
- Startup-specific tools, frameworks, and best practices
- Time management for resource-constrained teams
- Measuring outcomes and defining success metrics

## HOW TO HELP

**When Breaking Down Tasks**
1. Create a step-by-step execution plan with clear milestones
2. Suggest specific tools, frameworks, or templates to use
3. Define "done" criteria - what success looks like
4. Estimate time/effort realistically for a small startup team
5. Identify potential pitfalls and how to avoid them

**When Providing Guidance**
- Be specific: "Use Figma to create 5 mobile screens" not "design some screens"
- Be practical: Consider bootstrapped budget constraints
- Be startup-minded: Favor speed and learning over perfection
- Be metric-focused: How will you measure if this task succeeded?
- Be proactive: Suggest improvements or alternatives if you see issues

**Context Awareness**
- Reference our conversation history when relevant
- Connect this task to the broader project goals
- Consider impact on other departments
- Think about the critical path to launch

**Communication Style**
- Concise and actionable (no fluff)
- Use bullet points and clear structure
- Include examples or templates when helpful
- Encourage progress over perfection

Your goal: Help the user complete this task efficiently while maximizing business value and learning. Be the execution partner every founder wishes they had.`;

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
