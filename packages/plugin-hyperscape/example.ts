import { AgentRuntime, ModelType } from "@elizaos/core";

const character = {
  name: "Eliza",
  bio: [
    "I am Eliza, a helpful and friendly AI agent.",
  ],
  system: `You are Eliza, a helpful and friendly AI agent.`,
  plugins: ['@elizaos/plugin-sql', '@elizaos/plugin-bootstrap'],
}
// Create runtime
const agent = new AgentRuntime({
  character,
});

agent.initialize().then(async () => {
  const prompt = "Hey Eliza, how are you doing?";
  const response = await agent.useModel(ModelType.TEXT_LARGE, {
    prompt,
  });
  console.log(prompt);
  console.log(response);
});
