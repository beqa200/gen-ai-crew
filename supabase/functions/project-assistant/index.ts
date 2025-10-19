import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, projectId, chatHistory } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Fetch project details
    const { data: project } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    // Fetch all departments
    const { data: departments } = await supabaseClient
      .from('departments')
      .select('*')
      .eq('project_id', projectId);

    // Fetch all tasks
    const departmentIds = departments?.map(d => d.id) || [];
    const { data: tasks } = await supabaseClient
      .from('tasks')
      .select('*')
      .in('department_id', departmentIds);

    // Fetch all task dependencies
    const taskIds = tasks?.map(t => t.id) || [];
    const { data: dependencies } = await supabaseClient
      .from('task_dependencies')
      .select('*')
      .in('task_id', taskIds);

    // Fetch all task AI messages
    const { data: taskMessages } = await supabaseClient
      .from('task_ai_messages')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true });

    // Build comprehensive context
    const projectContext = {
      project: {
        name: project?.name,
        description: project?.description,
        created_at: project?.created_at,
      },
      departments: departments?.map(d => ({
        name: d.name,
        tasks: tasks?.filter(t => t.department_id === d.id).map(t => {
          const taskConversations = taskMessages?.filter(m => m.task_id === t.id) || [];
          return {
            title: t.title,
            description: t.description,
            status: t.status,
            created_at: t.created_at,
            dependencies: dependencies?.filter(dep => dep.task_id === t.id).length || 0,
            aiConversationHistory: taskConversations.map(msg => ({
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at
            }))
          };
        }),
      })),
      statistics: {
        totalDepartments: departments?.length || 0,
        totalTasks: tasks?.length || 0,
        completedTasks: tasks?.filter(t => t.status === 'completed').length || 0,
        inProgressTasks: tasks?.filter(t => t.status === 'in_progress').length || 0,
        pendingTasks: tasks?.filter(t => t.status === 'pending').length || 0,
      }
    };

    const systemPrompt = `You are a powerful AI assistant for the project "${project?.name}".

PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

Your role is to help manage this project completely. You can:
- Create, update, and delete tasks
- Change task statuses
- Add or remove task dependencies
- Provide insights and analysis

You have access to all project details including departments, tasks, statuses, dependencies, and complete AI conversation histories for each task.

When users ask you to make changes, use the available tools to execute them immediately. Be proactive and helpful.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a new task in a department",
          parameters: {
            type: "object",
            properties: {
              department_name: { type: "string", description: "Name of the department" },
              title: { type: "string", description: "Task title" },
              description: { type: "string", description: "Task description" }
            },
            required: ["department_name", "title", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_task",
          description: "Delete a task by its title",
          parameters: {
            type: "object",
            properties: {
              task_title: { type: "string", description: "Title of the task to delete" }
            },
            required: ["task_title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_task_status",
          description: "Update the status of a task",
          parameters: {
            type: "object",
            properties: {
              task_title: { type: "string", description: "Title of the task" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"], description: "New status" }
            },
            required: ["task_title", "status"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_dependency",
          description: "Add a dependency between tasks (task A depends on task B)",
          parameters: {
            type: "object",
            properties: {
              task_title: { type: "string", description: "Title of the task that has the dependency" },
              depends_on_title: { type: "string", description: "Title of the task it depends on" }
            },
            required: ["task_title", "depends_on_title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "remove_dependency",
          description: "Remove a dependency between tasks",
          parameters: {
            type: "object",
            properties: {
              task_title: { type: "string", description: "Title of the task" },
              depends_on_title: { type: "string", description: "Title of the task it depends on" }
            },
            required: ["task_title", "depends_on_title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_task_name",
          description: "Update the name/title of a task",
          parameters: {
            type: "object",
            properties: {
              old_title: { type: "string", description: "Current title of the task" },
              new_title: { type: "string", description: "New title for the task" }
            },
            required: ["old_title", "new_title"]
          }
        }
      }
    ];

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: message }
    ];

    console.log('Sending request to AI with project context and tools');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI service requires payment. Please add credits to continue.');
      }
      
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    const choice = data.choices[0];
    
    // Handle tool calls
    if (choice.message.tool_calls) {
      console.log('AI requested tool calls:', JSON.stringify(choice.message.tool_calls));
      
      const toolResults = [];
      for (const toolCall of choice.message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        let result;
        try {
          switch (functionName) {
            case 'create_task': {
              const dept = departments?.find(d => d.name === args.department_name);
              if (!dept) {
                result = { error: `Department "${args.department_name}" not found` };
              } else {
                // Check if task with same title already exists in this department
                const existingTask = tasks?.find(t => 
                  t.department_id === dept.id && t.title === args.title
                );
                
                if (existingTask) {
                  result = { success: false, message: `Task "${args.title}" already exists in ${args.department_name}` };
                } else {
                  const { data: newTask, error } = await supabaseClient
                    .from('tasks')
                    .insert({
                      department_id: dept.id,
                      title: args.title,
                      description: args.description,
                      status: 'pending'
                    })
                    .select()
                    .single();
                  result = error ? { error: error.message } : { success: true, task: newTask };
                }
              }
              break;
            }
            
            case 'delete_task': {
              const task = tasks?.find(t => t.title === args.task_title);
              if (!task) {
                result = { error: `Task "${args.task_title}" not found` };
              } else {
                // Delete dependencies first
                await supabaseClient
                  .from('task_dependencies')
                  .delete()
                  .or(`task_id.eq.${task.id},depends_on_task_id.eq.${task.id}`);
                
                const { error } = await supabaseClient
                  .from('tasks')
                  .delete()
                  .eq('id', task.id);
                result = error ? { error: error.message } : { success: true };
              }
              break;
            }
            
            case 'update_task_status': {
              const task = tasks?.find(t => t.title === args.task_title);
              if (!task) {
                result = { error: `Task "${args.task_title}" not found` };
              } else {
                const { error } = await supabaseClient
                  .from('tasks')
                  .update({ status: args.status })
                  .eq('id', task.id);
                result = error ? { error: error.message } : { success: true };
              }
              break;
            }
            
            case 'add_dependency': {
              const task = tasks?.find(t => t.title === args.task_title);
              const dependsOnTask = tasks?.find(t => t.title === args.depends_on_title);
              if (!task) {
                result = { error: `Task "${args.task_title}" not found` };
              } else if (!dependsOnTask) {
                result = { error: `Task "${args.depends_on_title}" not found` };
              } else {
                const { error } = await supabaseClient
                  .from('task_dependencies')
                  .insert({
                    task_id: task.id,
                    depends_on_task_id: dependsOnTask.id
                  });
                result = error ? { error: error.message } : { success: true };
              }
              break;
            }
            
            case 'remove_dependency': {
              const task = tasks?.find(t => t.title === args.task_title);
              const dependsOnTask = tasks?.find(t => t.title === args.depends_on_title);
              if (!task || !dependsOnTask) {
                result = { error: 'Task not found' };
              } else {
                const { error } = await supabaseClient
                  .from('task_dependencies')
                  .delete()
                  .eq('task_id', task.id)
                  .eq('depends_on_task_id', dependsOnTask.id);
                result = error ? { error: error.message } : { success: true };
              }
              break;
            }
            
            case 'update_task_name': {
              const task = tasks?.find(t => t.title === args.old_title);
              if (!task) {
                result = { error: `Task "${args.old_title}" not found` };
              } else {
                const { error } = await supabaseClient
                  .from('tasks')
                  .update({ title: args.new_title })
                  .eq('id', task.id);
                result = error ? { error: error.message } : { success: true };
              }
              break;
            }
            
            default:
              result = { error: 'Unknown function' };
          }
        } catch (err) {
          result = { error: err instanceof Error ? err.message : 'Unknown error' };
        }
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(result)
        });
      }
      
      // Send tool results back to AI for final response
      const followUpMessages = [
        ...messages,
        choice.message,
        ...toolResults
      ];
      
      const followUpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: followUpMessages,
        }),
      });
      
      if (!followUpResponse.ok) {
        throw new Error('Failed to get follow-up AI response');
      }
      
      const followUpData = await followUpResponse.json();
      const finalResponse = followUpData.choices[0].message.content;
      
      return new Response(
        JSON.stringify({ response: finalResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No tool calls, return direct response
    const aiResponse = choice.message.content;

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in project-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});