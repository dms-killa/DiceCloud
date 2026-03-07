'use strict';

// OpenAI-compatible provider — works with OpenAI, Mistral, Ollama, and any
// service that implements the /v1/chat/completions endpoint.
//
// Contract: async (systemPrompt, userPrompt, options) => string
//
// Ollama example:
//   node ingest.js ... --provider ollama --base-url http://localhost:11434/v1 --model llama3.2

module.exports = async function complete(systemPrompt, userPrompt, options = {}) {
  let OpenAI;
  try {
    OpenAI = require('openai');
  } catch (_) {
    console.error('Error: openai package is not installed. Run: npm install openai');
    process.exit(1);
  }

  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || 'ollama';
  const baseURL = options.baseUrl || undefined;

  const client = new OpenAI({ apiKey, baseURL });
  const model = options.model || 'gpt-4o';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || '';
};
