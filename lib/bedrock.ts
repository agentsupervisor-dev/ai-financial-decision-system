import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function askClaude(prompt: string) {
  const command = new InvokeModelCommand({
    modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    }),
  });

  const response = await client.send(command);
  const decoded = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(decoded);
  return parsed.content?.[0]?.text || "No response";
}

export async function callClaude(
  prompt: string,
  options?: { system?: string; maxTokens?: number }
): Promise<string> {
  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: options?.maxTokens ?? 600,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  };
  if (options?.system) body.system = options.system;

  const command = new InvokeModelCommand({
    modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const response = await client.send(command);
  const decoded = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(decoded);
  return parsed.content?.[0]?.text ?? "";
}