// Example: Advanced usage of runWithTools
// This example demonstrates features like recursive tool calls, verbose logging,
// strict validation, streaming responses, and custom model parameters.

import { runWithTools, AiTextGenerationToolInputWithFunction } from "../../src/index"; // Adjust path as needed
import { Ai, RoleScopedChatInput, AiTextGenerationOutput } from "@cloudflare/workers-types";

// Mock environment for demonstration purposes
// In a real Cloudflare Worker, `env.AI` would be provided by the runtime.
const mockEnv = {
  AI: {
    run: async (model: string, inputs: any): Promise<AiTextGenerationOutput | ReadableStream<AiTextGenerationOutput>> => {
      console.log(`[Mock AI.run] Model: ${model}, Inputs:`, JSON.stringify(inputs, null, 2));
      // Simulate LLM behavior for tool calls and final response
      if (inputs.messages.slice(-1)[0].role === "user") {
        if (inputs.messages.slice(-1)[0].content.includes("What is (5 plus 10) multiplied by 3?")) {
          return {
            tool_calls: [{ name: "sum", arguments: { a: 5, b: 10 } }]
          };
        }
      } else if (inputs.messages.slice(-1)[0].role === "tool" && inputs.messages.slice(-1)[0].name === "sum") {
        // Assuming the sum was 15 from the tool_result
        return {
          tool_calls: [{ name: "multiply", arguments: { a: 15, b: 3 } }]
        };
      }
      // Final response after all tool calls
      if (inputs.stream) {
        return new ReadableStream<AiTextGenerationOutput>({
          start(controller) {
            controller.enqueue({ response: "The " });
            controller.enqueue({ response: "final " });
            controller.enqueue({ response: "answer " });
            controller.enqueue({ response: "is " });
            controller.enqueue({ response: "45." });
            controller.close();
          }
        });
      } else {
        return { response: "The final answer is 45." };
      }
    }
  } as Ai
};

// Define Tools
const tools: AiTextGenerationToolInputWithFunction[] = [
  {
    name: "sum",
    description: "Calculates the sum of two numbers.",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
    function: async ({ a, b }: { a: number; b: number }) => {
      console.log(`[Tool sum] Calculating ${a} + ${b}`);
      return a + b;
    },
  },
  {
    name: "multiply",
    description: "Calculates the product of two numbers.",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
    function: async ({ a, b }: { a: number; b: number }) => {
      console.log(`[Tool multiply] Calculating ${a} * ${b}`);
      return a * b;
    },
  },
];

// Main function to demonstrate runWithTools
async function advancedExample(env: { AI: Ai }) {
  const initialMessages: RoleScopedChatInput[] = [
    { role: "user", content: "What is (5 plus 10) multiplied by 3?" },
  ];

  console.log("Starting advanced runWithTools example...");

  try {
    const { response, messages: finalMessages } = await runWithTools(
      env.AI,
      "@hf/nousresearch/hermes-2-pro-mistral-7b", // Example model
      {
        messages: initialMessages,
        tools: tools,
      },
      {
        streamFinalResponse: true,
        maxRecursiveToolRuns: 2, // Allow for chained tool calls (e.g., sum -> multiply)
        strictValidation: true,  // Validate arguments passed to tools
        verbose: true,           // Enable detailed logging from runWithTools
        max_tokens: 100,         // Max tokens for the final response
        temperature: 0.5,        // Model temperature
      }
    );

    console.log("\n--- Final Response (Streaming) ---");
    // The 'response' from runWithTools is directly the ReadableStream when streamFinalResponse is true
    if (response instanceof ReadableStream) {
      const reader = response.getReader();
      // const decoder = new TextDecoder(); // AiTextGenerationOutput streams {response: string} chunks directly
      let fullResponse = "";
      while (true) {
        const { done, value }: { done: boolean, value?: AiTextGenerationOutput } = await reader.read();
        if (done) break;
        // value will be like { response: "chunk of text" }
        if (value && typeof value.response === 'string') {
          fullResponse += value.response;
          console.log("Stream chunk:", value.response);
        }
      }
      console.log("Full streamed response:", fullResponse);
    } else {
      // This case should not be hit if streamFinalResponse: true and the AI mock works as expected.
      // However, runWithTools itself returns RunWithToolsResponse = { response: AiTextGenerationOutput | ReadableStream, messages: ... }
      // So, if not a stream, response is AiTextGenerationOutput
      const aiOutput = response as AiTextGenerationOutput;
      console.log("Final response (non-streamed):", aiOutput.response);
    }

    console.log("\n--- All Messages Exchanged ---");
    finalMessages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`, JSON.stringify(msg, null, 2));
    });

  } catch (error) {
    console.error("Error in advancedExample:", error);
  }
}

// Run the example
advancedExample(mockEnv);
