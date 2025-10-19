import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, userMessage } = await req.json();
    console.log("Generating tasks for project:", projectId);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // System prompt that instructs AI to be creative and fill gaps
    const systemPrompt = `You are a senior startup advisor with experience from Y Combinator, 500 Startups, and successful exits. You specialize in lean startup methodology, MVP development, and rapid market validation.

## YOUR MISSION
Transform ANY startup idea (even vague ones) into a detailed, strategic action plan that maximizes speed-to-market and validates product-market fit with minimal resources.

## CRITICAL ALIGNMENT RULE
ALL tasks across ALL departments MUST be directly tied to the SPECIFIC startup idea provided by the user. Development tasks MUST implement the exact product features defined in Product Execution. Marketing tasks MUST promote the specific value proposition of THIS startup. Do NOT generate generic tasks - every task must reference and build the actual startup concept.

## CORE PRINCIPLES
1. **MVP-First Mindset**: Every task should drive toward launching THIS SPECIFIC testable minimum viable product
2. **Customer-Obsessed**: Tasks must connect to real user needs for THIS SPECIFIC product
3. **Measured Progress**: Each task should have clear success metrics tied to THIS startup's goals
4. **Startup Velocity**: Prioritize speed and learning over perfection
5. **Resource-Conscious**: Assume limited budget and small team
6. **Idea-Centered**: Constantly reference back to the core startup idea in every task

## TASK GENERATION RULES
Generate highly detailed tasks per department that:
- Are specific and measurable (not vague like "research market")
- Include concrete deliverables directly related to THIS startup
- Have clear business value tied to THIS product's success
- Consider startup constraints (time, budget, team size)
- Follow lean startup best practices
- EXPLICITLY mention the startup's core features/value proposition

## THREE DEPARTMENTS

### Product Execution
Focus: Product strategy, user research, feature prioritization, UX/UI, roadmap, metrics FOR THIS SPECIFIC PRODUCT
Tasks should cover: User personas FOR THIS PRODUCT, competitive analysis of SIMILAR products, feature specs for THIS PRODUCT's unique features, wireframes of THIS PRODUCT's interface, user stories for THIS PRODUCT's use cases, success metrics for THIS PRODUCT

### Development  
Focus: Building the ACTUAL features and functionality of THIS SPECIFIC PRODUCT
Tasks should cover: Implementing THIS PRODUCT's core features, database schema for THIS PRODUCT's data, APIs for THIS PRODUCT's functionality, user authentication for THIS PRODUCT, UI components for THIS PRODUCT's interface, integrations THIS PRODUCT needs
CRITICAL: Development tasks must implement the EXACT features described in Product Execution tasks. No generic infrastructure tasks unless directly needed for THIS product.

### Marketing
Focus: Go-to-market strategy for THIS SPECIFIC PRODUCT and its unique value proposition
Tasks should cover: Value proposition highlighting THIS PRODUCT's benefits, landing page showcasing THIS PRODUCT, content about THIS PRODUCT's solution, outreach to THIS PRODUCT's target users, SEO for THIS PRODUCT's keywords, growth channels for THIS PRODUCT's audience

## TASK FORMAT
- **Title**: Action-oriented, specific, mentioning the actual feature/product element (e.g., "Build real-time chat system with message threading" not "Setup messaging")
- **Description**: 100-200 words covering highly detailed and technical specifications FOR THIS SPECIFIC PRODUCT. Include: exact features/functionality of THIS product, specific UI/UX requirements for THIS product's interface, technical implementation details for THIS product's features, data structures/models needed for THIS product, user flows specific to THIS product, edge cases in THIS product's context, and design patterns for THIS product. Write as if you're directly instructing Claude AI to build THIS SPECIFIC feature for THIS SPECIFIC startup - be extremely explicit about what needs to be built and how it should work IN THE CONTEXT OF THIS STARTUP IDEA.
- **Dependencies**: Array of 0-based indexes within SAME department (e.g., [0,1] means depends on tasks at index 0 and 1)

## CROSS-DEPARTMENT ALIGNMENT
- Development tasks MUST implement features defined in Product Execution
- Marketing tasks MUST promote the specific features being built
- All tasks must work together to build and launch THIS SPECIFIC PRODUCT

CRITICAL: Generate startup-ready, detailed tasks that directly build THIS SPECIFIC PRODUCT. Every task should explicitly reference the startup idea and move the needle toward launching THIS EXACT PRODUCT and generating revenue from it.`;

    const body: any = {
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
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
                        enum: ["Product Execution", "Development", "Marketing"],
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
                              description:
                                "Array of task indexes (0-based) within this department that this task depends on. Use empty array [] if no dependencies.",
                            },
                          },
                          required: ["title", "description", "dependsOn"],
                          additionalProperties: false,
                        },
                        minItems: 5,
                        maxItems: 8,
                      },
                    },
                    required: ["name", "tasks"],
                    additionalProperties: false,
                  },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["departments"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "create_startup_plan" } },
    };

    console.log("Calling OpenAI API...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const planData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed plan data:", JSON.stringify(planData, null, 2));

    // Save the initial prompt to project description
    const { error: updateError } = await supabase
      .from("projects")
      .update({ description: userMessage })
      .eq("id", projectId);

    if (updateError) {
      console.error("Error updating project description:", updateError);
      // Don't throw - this is not critical
    }

    // Create departments and tasks in database
    const createdDepartments = [];

    for (const dept of planData.departments) {
      // Create department
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .insert({
          project_id: projectId,
          name: dept.name,
        })
        .select()
        .single();

      if (deptError) {
        console.error("Error creating department:", deptError);
        throw deptError;
      }

      console.log(`Created department: ${dept.name}`);

      // Create tasks for this department
      const tasksToInsert = dept.tasks.map((task: any) => ({
        department_id: department.id,
        title: task.title,
        description: task.description,
        status: "pending",
      }));

      const { data: createdTasks, error: tasksError } = await supabase.from("tasks").insert(tasksToInsert).select();

      if (tasksError) {
        console.error("Error creating tasks:", tasksError);
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
                depends_on_task_id: createdTasks[depIndex].id,
              });
            }
          }
        }
      }

      if (dependencies.length > 0) {
        const { error: depsError } = await supabase.from("task_dependencies").insert(dependencies);

        if (depsError) {
          console.error("Error creating task dependencies:", depsError);
          // Don't throw - dependencies are not critical
        } else {
          console.log(`Created ${dependencies.length} task dependencies for ${dept.name}`);
        }
      }

      createdDepartments.push({
        ...department,
        taskCount: dept.tasks.length,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        departments: createdDepartments,
        message: `Successfully created ${createdDepartments.length} departments with tasks!`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in generate-tasks function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
