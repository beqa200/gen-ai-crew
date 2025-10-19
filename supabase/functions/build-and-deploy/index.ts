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
      ? `\n\n⚠️⚠️⚠️ CRITICAL: EXISTING PROJECT CODE BELOW - YOU MUST PRESERVE IT ⚠️⚠️⚠️\n\n${project.project_code}\n\n⚠️ DO NOT START FROM SCRATCH. DO NOT CREATE A NEW WEBSITE. DO NOT LOSE ANY EXISTING FEATURES. ⚠️\n\nYour task is to ADD the new functionality described below TO THE EXISTING CODE ABOVE. Keep everything that already works and integrate the new feature seamlessly.`
      : "";

    console.log(existingCodeContext ? "Updating existing project code..." : "Creating new project code...");

    const userPrompt = project.project_code 
      ? `You are enhancing an EXISTING web project called "${project.name}".
Project Description: ${project.description || "No description provided"}

⚠️⚠️⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY ⚠️⚠️⚠️

The EXISTING PROJECT CODE is provided above. This code is WORKING and contains features that users are already using.

NEW TASK TO ADD:
Title: ${taskTitle}
Description: ${taskDescription}

YOUR MISSION:
1. START with the existing code provided above as your BASE
2. PRESERVE all existing features, components, and functionality
3. ADD the new task's functionality by integrating it into the existing structure
4. ENHANCE and EXTEND - never replace or remove existing features
5. Maintain consistency with the existing design and code style

⚠️ DO NOT:
- Start from scratch with a blank page
- Create a new website
- Remove or replace existing features
- Create just a gradient background
- Ignore the existing code structure

✅ DO:
- Use the existing HTML structure as your foundation
- Add new sections/components alongside existing ones
- Integrate new features into existing navigation/layout
- Keep all existing JavaScript functionality
- Maintain the current design system and styling approach
- Build upon what's already there

TECHNICAL REQUIREMENTS:
- Self-contained single index.html file
- Tailwind CDN for styling (maintain existing approach)
- Modern, responsive design
- All features must be functional (no placeholders)
- Professional, production-ready code

Return ONLY the complete enhanced HTML code with both old and new features working together. No explanations or markdown formatting.`
      : `You are building a NEW web project called "${project.name}".
Project Description: ${project.description || "No description provided"}

TASK:
Title: ${taskTitle}
Description: ${taskDescription}

Requirements:
- Create a beautiful, modern, responsive design
- Include inline CSS (Tailwind CDN is acceptable)
- Include any necessary inline JavaScript
- Make it fully self-contained in a single index.html file
- Use modern design principles with good UX
- Make it visually appealing and professional
- All features must be fully functional (no placeholders)
- Production-ready code with proper error handling

Use modern web technologies and create a complete, working implementation. Include proper structure with semantic HTML, interactive components, and polished styling.

Return ONLY the complete HTML code, no explanations or markdown formatting.`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 25000,
        messages: [
          {
            role: "user",
            content: `${existingCodeContext}\n\n${userPrompt}`,
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
