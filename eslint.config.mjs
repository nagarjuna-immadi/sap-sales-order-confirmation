import cds from '@sap/cds/eslint.config.mjs'

// No code imports the Anthropic SDK: all Claude calls go through the CAP agent
// plugin @cap-js/agents (phase 7).
const anthropicSdk = {
  group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
  message: 'Call Claude through an @agent service (@cap-js/agents), not the Anthropic SDK.',
}

export default [
  ...cds.recommended,
  {
    rules: {
      'no-restricted-imports': ['error', { patterns: [anthropicSdk] }],
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
