import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, userMessage } = await req.json();
    console.log('Generating tasks for project:', projectId);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // System prompt that instructs AI to be creative and fill gaps
    const systemPrompt = `You are an expert startup consultant and project manager. Your role is to analyze startup ideas and create comprehensive action plans.

When a user describes their startup idea (even if vague or incomplete), you MUST:
1. Fill in any missing details with creative, reasonable assumptions
2. Generate complete, actionable tasks across three departments
3. NEVER ask for clarification - be proactive and creative
4. Generate 5-8 detailed tasks per department (15-24 tasks total)
5. Identify logical dependencies - which tasks must be completed before others can start

The three departments are:
- Product Execution: Focus on product strategy, features, user experience, roadmap
- Development: Focus on technical implementation, architecture, infrastructure, coding tasks
- Marketing: Focus on user acquisition, branding, content, partnerships, growth

For each task:
- Title: Clear, actionable (5-10 words)
- Description: Detailed explanation with specific steps and goals (50-100 words)
- Dependencies: Indexes (0-based) of tasks within the SAME department that must be completed before this task (e.g., [0, 1] means depends on first and second task)

Be creative with incomplete ideas. If the user says "a fitness app", you should assume it's a mobile app with tracking, social features, gamification, etc. Make intelligent assumptions!

IMPORTANT: Dependencies are 0-indexed positions within each department's task list. A task can only depend on tasks that come BEFORE it in the list.`;

    const body: any = {
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "create_startup_plan",
            description: "Generate comprehensive departments and tasks for a startup project",
            parameters: {
              type: "object",
              properties: {
                departments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        enum: ["Product Execution", "Development", "Marketing"]
                      },
                      tasks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            dependsOn: { 
                              type: "array",
                              items: { type: "number" },
                              description: "Array of task indexes (0-based) within this department that this task depends on. Use empty array [] if no dependencies."
                            }
                          },
                          required: ["title", "description", "dependsOn"],
                          additionalProperties: false
                        },
                        minItems: 5,
                        maxItems: 8
                      }
                    },
                    required: ["name", "tasks"],
                    additionalProperties: false
                  },
                  minItems: 3,
                  maxItems: 3
                }
              },
              required: ["departments"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "create_startup_plan" } }
    };

    console.log('Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const planData = JSON.parse(toolCall.function.arguments);
    console.log('Parsed plan data:', JSON.stringify(planData, null, 2));

    // Save the initial prompt to project description
    const { error: updateError } = await supabase
      .from('projects')
      .update({ description: userMessage })
      .eq('id', projectId);

    if (updateError) {
      console.error('Error updating project description:', updateError);
      // Don't throw - this is not critical
    }

    // Create departments and tasks in database
    const createdDepartments = [];
    
    for (const dept of planData.departments) {
      // Create department
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .insert({
          project_id: projectId,
          name: dept.name
        })
        .select()
        .single();

      if (deptError) {
        console.error('Error creating department:', deptError);
        throw deptError;
      }

      console.log(`Created department: ${dept.name}`);

      // Create tasks for this department
      const tasksToInsert = dept.tasks.map((task: any) => ({
        department_id: department.id,
        title: task.title,
        description: task.description,
        status: 'pending'
      }));

      const { data: createdTasks, error: tasksError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select();

      if (tasksError) {
        console.error('Error creating tasks:', tasksError);
        throw tasksError;
      }

      console.log(`Created ${dept.tasks.length} tasks for ${dept.name}`);

      // Create task dependencies
      const dependencies = [];
      for (let i = 0; i < dept.tasks.length; i++) {
        const task = dept.tasks[i];
        if (task.dependsOn && Array.isArray(task.dependsOn) && task.dependsOn.length > 0) {
          for (const depIndex of task.dependsOn) {
            if (depIndex < i && depIndex >= 0 && createdTasks[depIndex]) {
              dependencies.push({
                task_id: createdTasks[i].id,
                depends_on_task_id: createdTasks[depIndex].id
              });
            }
          }
        }
      }

      if (dependencies.length > 0) {
        const { error: depsError } = await supabase
          .from('task_dependencies')
          .insert(dependencies);

        if (depsError) {
          console.error('Error creating task dependencies:', depsError);
          // Don't throw - dependencies are not critical
        } else {
          console.log(`Created ${dependencies.length} task dependencies for ${dept.name}`);
        }
      }

      createdDepartments.push({
        ...department,
        taskCount: dept.tasks.length
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        departments: createdDepartments,
        message: `Successfully created ${createdDepartments.length} departments with tasks!`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-tasks function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});