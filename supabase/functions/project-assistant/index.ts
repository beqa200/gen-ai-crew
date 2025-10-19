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
        tasks: tasks?.filter(t => t.department_id === d.id).map(t => ({
          title: t.title,
          description: t.description,
          status: t.status,
          dependencies: dependencies?.filter(dep => dep.task_id === t.id).length || 0,
          aiConversations: taskMessages?.filter(m => m.task_id === t.id).length || 0,
        })),
      })),
      statistics: {
        totalDepartments: departments?.length || 0,
        totalTasks: tasks?.length || 0,
        completedTasks: tasks?.filter(t => t.status === 'completed').length || 0,
        inProgressTasks: tasks?.filter(t => t.status === 'in_progress').length || 0,
        pendingTasks: tasks?.filter(t => t.status === 'pending').length || 0,
      }
    };

    const systemPrompt = `You are a helpful AI assistant for the project "${project?.name}".

PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

Your role is to help the user understand their project, provide insights, answer questions about tasks and progress, and offer strategic advice. You have access to all project details including departments, tasks, their statuses, dependencies, and previous AI conversations.

Be concise, helpful, and proactive in offering insights about the project's progress and potential issues.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: message }
    ];

    console.log('Sending request to AI with project context');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
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
    const aiResponse = data.choices[0].message.content;

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