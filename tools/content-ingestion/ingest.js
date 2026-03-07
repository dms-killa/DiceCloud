#!/usr/bin/env node
// ingest.js — Provider-agnostic content ingestion CLI
//
// Usage:
//   node ingest.js --pdf <path> --prompt expanse-ship --provider claude --output <path>
//
// See README.md for full option docs.

'use strict';

const fs = require('fs');
const path = require('path');

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

function usage() {
  console.error([
    '',
    'Usage: node ingest.js [options]',
    '',
    'Options:',
    '  --pdf       <path>       Path to source PDF file',
    '  --text      <path>       Path to plain-text file (alternative to --pdf)',
    '  --prompt    <name>       Prompt template name (from prompts/ dir)',
    '  --provider  <name>       claude | openai | ollama  (default: claude)',
    '  --model     <name>       Override model name',
    '  --output    <path>       Write generated script to this path (default: stdout)',
    '  --api-key   <key>        API key (or use ANTHROPIC_API_KEY / OPENAI_API_KEY env vars)',
    '  --base-url  <url>        Base URL for openai-compat provider (e.g. http://localhost:11434/v1)',
    '',
    'Examples:',
    '  node ingest.js --pdf ship.pdf --prompt expanse-ship --provider claude --output out.mongosh.js',
    '  node ingest.js --pdf ship.pdf --prompt expanse-ship --provider ollama --base-url http://localhost:11434/v1',
    '',
  ].join('\n'));
}

// ── Input validation ──────────────────────────────────────────────────────────

if (!args.pdf && !args.text) {
  console.error('Error: --pdf or --text is required');
  usage();
  process.exit(1);
}

if (!args.prompt) {
  console.error('Error: --prompt is required');
  usage();
  process.exit(1);
}

const providerName = args.provider || 'claude';

// ── Load prompt template ──────────────────────────────────────────────────────

const promptFile = path.join(__dirname, 'prompts', args.prompt + '.md');
if (!fs.existsSync(promptFile)) {
  const available = fs.readdirSync(path.join(__dirname, 'prompts'))
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
  console.error(`Error: prompt template "${args.prompt}" not found`);
  console.error(`Available prompts: ${available.join(', ')}`);
  process.exit(1);
}
const systemPrompt = fs.readFileSync(promptFile, 'utf8');

// ── Load source text ──────────────────────────────────────────────────────────

async function getSourceText() {
  if (args.text) {
    return fs.readFileSync(args.text, 'utf8');
  }
  const { readPdf } = require('./lib/pdf-reader');
  return readPdf(args.pdf);
}

// ── Load provider ─────────────────────────────────────────────────────────────

function loadProvider(name) {
  switch (name) {
    case 'claude':
      return require('./providers/claude');
    case 'openai':
    case 'ollama':
      return require('./providers/openai-compat');
    default:
      console.error(`Error: unknown provider "${name}". Choose: claude, openai, ollama`);
      process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Read source material
  process.stderr.write(`Reading source (${args.pdf || args.text})...\n`);
  const sourceText = await getSourceText();
  process.stderr.write(`  ${sourceText.length} characters extracted\n`);

  // Call LLM
  process.stderr.write(`Calling ${providerName}...\n`);
  const provider = loadProvider(providerName);
  const providerOptions = {
    model: args.model,
    apiKey: args['api-key'],
    baseUrl: args['base-url'],
  };

  const llmResponse = await provider(systemPrompt, sourceText, providerOptions);
  process.stderr.write('  LLM response received\n');

  // Extract JSON from response
  let shipJson;
  try {
    // Try to pull JSON out of a markdown code block if present
    const jsonMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      llmResponse.match(/(\{[\s\S]*\})/);
    const jsonText = jsonMatch ? jsonMatch[1] : llmResponse;
    shipJson = JSON.parse(jsonText.trim());
  } catch (err) {
    console.error('Error: failed to parse LLM response as JSON');
    console.error('Raw response:');
    console.error(llmResponse);
    process.exit(1);
  }

  // Determine content type from prompt name
  const { generateScript } = require('./lib/script-generator');
  process.stderr.write('Generating mongosh script...\n');
  const script = generateScript(args.prompt, shipJson);

  // Output
  if (args.output) {
    fs.writeFileSync(args.output, script, 'utf8');
    process.stderr.write(`Script written to ${args.output}\n`);
  } else {
    process.stdout.write(script);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
