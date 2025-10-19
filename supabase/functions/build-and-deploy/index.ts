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
    const { taskId, taskTitle, taskDescription } = await req.json();

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

    // Step 1: Generate website code using Claude
    console.log("Calling Claude API to generate website code...");
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `Create a complete, production-ready website with modern technologies (React.js or Next.js for example) for the following task:

Title: ${taskTitle}
Description: ${taskDescription}

Requirements:
- Create a beautiful, modern, responsive design
- Include inline CSS (Tailwind CDN is acceptable) 
- Include any necessary inline JavaScript
- Make it fully self-contained in a single index.html file
- Use modern design principles with good UX
- Make it visually appealing and professional

Return ONLY the complete HTML code, no explanations or markdown formatting.`,
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

    // Create deployment payload
    const deploymentPayload = {
      name: `task-${taskId.slice(0, 8)}`,
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

    // Step 3: Update task with deployed URL
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
