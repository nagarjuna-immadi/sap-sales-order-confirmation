import cds from '@sap/cds/eslint.config.mjs'

// Agents never import the Anthropic SDK directly: all Claude calls go through
// the one LLM client module in srv/lib/llm/ (phase 7).
const anthropicSdk = {
  group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
  message: 'Import the LLM client from srv/lib/llm/ instead of the Anthropic SDK.',
}

export default [
  ...cds.recommended,
  {
    rules: {
      'no-restricted-imports': ['error', { patterns: [anthropicSdk] }],
    },
  },
  {
    files: ['srv/lib/llm/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // Command-line scripts report on the console.
  {
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
]
