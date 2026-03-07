'use strict';

// Claude provider — uses @anthropic-ai/sdk
// Contract: async (systemPrompt, userPrompt, options) => string

module.exports = async function complete(systemPrompt, userPrompt, options = {}) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch (_) {
    console.error('Error: @anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk');
    process.exit(1);
  }

  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: Anthropic API key required. Set ANTHROPIC_API_KEY or pass --api-key');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const model = options.model || 'claude-sonnet-4-6';

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
};
