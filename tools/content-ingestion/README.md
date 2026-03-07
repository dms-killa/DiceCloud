# DiceCloud Content Ingestion CLI

A provider-agnostic CLI that reads TTRPG source material (PDF or plain text), calls an LLM to extract structured data, and generates a ready-to-run mongosh insert script for DiceCloud.

## Install

```bash
cd tools/content-ingestion
npm install
```

Provider SDKs are optional dependencies — install only what you need:

```bash
npm install @anthropic-ai/sdk   # for --provider claude
npm install openai               # for --provider openai or --provider ollama
```

## Usage

```
node ingest.js [options]

Options:
  --pdf       <path>    Path to source PDF file
  --text      <path>    Path to plain-text file (alternative to --pdf)
  --prompt    <name>    Prompt template name (from prompts/ directory, without .md)
  --provider  <name>    claude | openai | ollama  (default: claude)
  --model     <name>    Override model name
  --output    <path>    Write generated script to this path (default: stdout)
  --api-key   <key>     API key (or set ANTHROPIC_API_KEY / OPENAI_API_KEY env var)
  --base-url  <url>     Base URL for openai-compat providers
```

## Examples

### Extract an Expanse ship from a PDF (Claude)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node ingest.js \
  --pdf /path/to/expanse-ships.pdf \
  --prompt expanse-ship \
  --provider claude \
  --output /tmp/my-ship.mongosh.js
```

### Use Ollama locally (no API key needed)

```bash
node ingest.js \
  --pdf /path/to/expanse-ships.pdf \
  --prompt expanse-ship \
  --provider ollama \
  --base-url http://localhost:11434/v1 \
  --model llama3.2 \
  --output /tmp/my-ship.mongosh.js
```

### Use OpenAI

```bash
export OPENAI_API_KEY=sk-...
node ingest.js \
  --pdf /path/to/expanse-ships.pdf \
  --prompt expanse-ship \
  --provider openai \
  --model gpt-4o \
  --output /tmp/my-ship.mongosh.js
```

### From plain text (skip PDF extraction)

```bash
node ingest.js \
  --text /path/to/stat-block.txt \
  --prompt expanse-ship \
  --provider claude \
  --output /tmp/my-ship.mongosh.js
```

### Run the generated script

```bash
# Against a local Docker DB:
docker exec -i dicecloud-db mongosh \
  "mongodb://meteor:meteor@localhost:27017/test?authSource=admin" \
  < /tmp/my-ship.mongosh.js

# Or directly with mongosh:
mongosh "mongodb://meteor:meteor@localhost:27017/test?authSource=admin" \
  < /tmp/my-ship.mongosh.js
```

After inserting, add the new library ID to `DEFAULT_LIBRARIES` in your docker-compose environment, or subscribe to it in-app.

## Adding a new provider

1. Create `providers/<name>.js` exporting one async function:

```js
module.exports = async function complete(systemPrompt, userPrompt, options) {
  // options: { model, apiKey, baseUrl }
  // returns: string
};
```

2. Add a `case` for it in the `loadProvider` switch in `ingest.js`.

## Adding a new content type

1. Create `prompts/<type>.md` with the extraction prompt and JSON schema.
2. Add a `case` for it in the `generateScript` switch in `lib/script-generator.js` and implement the generator function.

## File structure

```
tools/content-ingestion/
├── ingest.js               CLI entry point
├── package.json
├── README.md
├── providers/
│   ├── claude.js           @anthropic-ai/sdk
│   └── openai-compat.js    openai SDK (OpenAI, Ollama, Mistral, etc.)
├── prompts/
│   └── expanse-ship.md     Extraction prompt for Expanse ship stat blocks
└── lib/
    ├── pdf-reader.js        PDF text extraction (pdf-parse)
    └── script-generator.js LLM JSON → mongosh script
```
