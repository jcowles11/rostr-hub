// @ts-check
/**
 * test-ai-coach.mjs — one-shot smoke test for AI Coach integration.
 * Verifies Anthropic API key works + we get back a coherent response.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const file = resolve(process.cwd(), ".env.local");
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?/);
    if (m) process.env[m[1]] = m[2];
  }
}
loadEnv();

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("❌ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log("→ Calling Claude with minimal test prompt…");
const start = Date.now();
try {
  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 120,
    system:
      "You are Rostr's AI Co-coach for a high school baseball team. Keep it tight.",
    messages: [
      {
        role: "user",
        content:
          "We have 16 players on Varsity. Our next game is Tuesday vs the Central Hawks at home, and 2 players are questionable with minor injuries. In 2 short sentences, tell me the main thing to focus on at practice tomorrow.",
      },
    ],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const text = res.content.find((c) => c.type === "text");
  const message = text && "text" in text ? text.text : "(no text)";
  console.log(`\n✅ Got response in ${elapsed}s (model=${res.model}):\n`);
  console.log(message);
  console.log(
    `\n   tokens in=${res.usage.input_tokens} out=${res.usage.output_tokens}`,
  );
  console.log(
    `   cost≈$${(
      (res.usage.input_tokens * 3 + res.usage.output_tokens * 15) /
      1_000_000
    ).toFixed(4)}`,
  );
  console.log("\n🎉 AI Coach integration works.");
} catch (err) {
  console.error("\n❌ AI Coach failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
