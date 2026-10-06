import cds from '@sap/cds/eslint.config.mjs'

// No code imports the Anthropic SDK: all Claude calls go through the CAP agent
// plugin @cap-js/agents (phase 6).
const anthropicSdk = {
  group: ['@anthropic-ai/sdk', '@anthropic-ai/sdk/*'],
  message: 'Call Claude through an @agent service (@cap-js/agents), not the Anthropic SDK.',
}

export default [
  // UI5 build output
  { ignores: ['app/*/dist/**'] },
  ...cds.recommended,
  {
    rules: {
      'no-restricted-imports': ['error', { patterns: [anthropicSdk] }],
    },
  },
  // The Order Assistant is read-only and has no path to any action (phase 7):
  // nothing from another agent's folder, in particular not the orchestrator.
  // Shared code is in srv/lib/.
  {
    files: ['srv/agents/order-assistant/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            anthropicSdk,
            {
              regex: '^\\.\\./(?!\\.\\./)|/agents/(?!order-assistant/)',
              message: 'The Order Assistant must not import from another agent folder; move shared code to srv/lib/.',
            },
          ],
        },
      ],
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
