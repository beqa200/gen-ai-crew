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
    const { taskId, taskTitle, taskDescription, projectId } = await req.json();

    console.log("Starting build and deploy for task:", taskId);

    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    const vercelToken = Deno.env.get("VERCEL_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!claudeApiKey || !vercelToken) {
      throw new Error("Missing required API keys");
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project details to get existing code
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("project_code, deployed_url, vercel_project_id, name, description")
      .eq("id", projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      throw projectError;
    }

    console.log("Project found:", project.name);

    // Step 1: Generate/update website code using Claude
    const existingCodeContext = project.project_code
      ? `\n\nEXISTING PROJECT CODE:\n${project.project_code}\n\nYou MUST build upon this existing code. Add the new task's functionality to it. Keep all existing features and enhance the project.`
      : "";

    console.log(existingCodeContext ? "Updating existing project code..." : "Creating new project code...");

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: `You are an expert full-stack developer building a production-ready web project called "${project.name}".

Project Description: ${project.description || "No description provided"}

Current Task:
Title: ${taskTitle}
Description: ${taskDescription}
${existingCodeContext}

CRITICAL REQUIREMENTS - YOU MUST IMPLEMENT ALL OF THESE:

1. **Complete Implementation**: Implement EVERY SINGLE feature, functionality, and requirement mentioned in the task description above. Do not skip anything or create placeholder comments like "// Add feature here". Write the actual working code for everything.

2. **Technical Excellence**:
   - Write production-ready, fully functional code
   - Include all necessary logic, state management, and data handling
   - Implement proper error handling and edge cases
   - Add form validation where needed
   - Make all interactive elements actually work

3. **Design Quality**:
   - Create a stunning, modern, professional design
   - Use Tailwind CDN for styling
   - Ensure fully responsive layout (mobile, tablet, desktop)
   - Add smooth animations and transitions
   - Use a cohesive color scheme and typography

4. **Code Structure**:
   - Use React with functional components and hooks
   - Include all necessary state management
   - Write clean, organized, well-commented code
   - Import and use any necessary libraries via CDN

5. **Integration with Existing Code** (if applicable):
   ${project.project_code ? "- CRITICAL: You MUST preserve ALL existing features and functionality from the existing code\n   - Add the new task's features alongside existing features, do not replace anything\n   - Maintain all existing UI elements, components, and logic\n   - Ensure the new features integrate seamlessly with existing features\n   - If there are navigation elements, add the new feature to the navigation" : "- This is a new project, build a complete standalone application"}

6. **Completeness Check**:
   - Re-read the task description before finishing
   - Verify you've implemented every feature mentioned
   - Ensure nothing is left as TODO or placeholder
   - Make sure all buttons, forms, and interactions are fully functional

Return ONLY the complete, production-ready HTML code with inline React and Tailwind. No explanations, no markdown formatting, just the raw HTML file.`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text();
      console.error("Claude API error:", error);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const generatedHtml = claudeData.content[0].text;

    console.log("Website code generated successfully");

    // Step 2: Deploy to Vercel
    console.log("Deploying to Vercel...");

    // Use existing project name or create new one
    const projectName = project.vercel_project_id || `project-${projectId.slice(0, 8)}`;

    // Create deployment payload
    const deploymentPayload = {
      name: projectName,
      files: [
        {
          file: "index.html",
          data: generatedHtml,
        },
      ],
      projectSettings: {
        framework: null,
      },
    };

    const vercelResponse = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deploymentPayload),
    });

    if (!vercelResponse.ok) {
      const error = await vercelResponse.text();
      console.error("Vercel deployment error:", error);
      throw new Error(`Vercel deployment error: ${vercelResponse.status}`);
    }

    const vercelData = await vercelResponse.json();
    const deployedUrl = `https://${vercelData.url}`;

    console.log("Deployed successfully:", deployedUrl);

    // Step 3: Update project with code and deployment info
    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update({
        project_code: generatedHtml,
        deployed_url: deployedUrl,
        vercel_project_id: projectName,
      })
      .eq("id", projectId);

    if (projectUpdateError) {
      console.error("Error updating project:", projectUpdateError);
      throw projectUpdateError;
    }

    // Step 4: Update task status and URL
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        deployed_url: deployedUrl,
        status: "in_progress",
      })
      .eq("id", taskId);

    if (updateError) {
      console.error("Error updating task:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deployedUrl,
        message: "Website built and deployed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in build-and-deploy function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
