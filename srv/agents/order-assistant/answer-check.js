// Number check of the Order Assistant's answers (blueprint §6.2, development
// plan 7.1): every number, date, time and ID in the final answer of a turn
// must appear in the results of this turn's tool calls (srv/lib/number-check.js,
// the same check as A2–A5). Otherwise the answer becomes NOT_VERIFIED and the
// app shows only the data cards.
//
// A middleware added to the plugin's chain (srv.after('buildMiddleware')): its
// afterModel hook sees each model turn; the final one (no tool calls) is
// checked and, on failure, replaced in the graph state by a message with the
// same ID. The plugin then sends the replaced text as the "response" artifact
// and keeps it in the conversation (spike 7.0). Token streaming is off, so an
// unchecked answer is never on screen.
//
// - The facts are the results of the service's own functions and of the
//   query tool since the user's last message, error texts included (they come
//   from our handlers, e.g. "Case FC-0099 not found"). The deep agent's file
//   tools (skills) and the describe tool do not count: their texts hold
//   example IDs.
// - Claude and the tool results both carry the masking pseudonyms
//   (customerName-<hash>), so they are compared as they are; a pseudonym in the
//   answer that no tool returned would show up unresolved and fails too.

import cds from '@sap/cds'
import { checkText, factsOf } from '../../lib/number-check.js'

const LOG = cds.log('order-assistant')

export const NOT_VERIFIED = "I couldn't verify this answer. See the data below."

// The plugin's pseudonyms: element name and a hex hash, e.g. customerName-9e9444a2b952cae6.
const PSEUDONYM = /\b[a-z][A-Za-z]*-[0-9a-f]{8,}\b/g

/** Text of a message's content (a string or content blocks). */
const textOf = content =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter(b => b?.type === 'text').map(b => b.text).join('')
      : ''

/** The results of the tools in `tools` since the last user message. */
function turnResults(messages, tools) {
  const start = messages.findLastIndex(m => m.type === 'human')
  const turn = messages.slice(start + 1)
  const names = new Map(turn.flatMap(m => m.tool_calls ?? []).map(c => [c.id, c.name]))
  return turn.filter(m => m.type === 'tool' && tools.has(names.get(m.tool_call_id) ?? m.name)).map(m => textOf(m.content))
}

/** The middleware for `srv` (the OrderAssistantService). */
export function answerCheck(srv) {
  const tools = new Set([...Object.keys(srv.actions ?? {}), 'query'])
  return {
    name: 'orderAssistantAnswerCheck',
    afterModel: state => {
      const messages = state.messages ?? []
      const answer = messages.at(-1)
      if (answer?.type !== 'ai' || answer.tool_calls?.length) return
      const text = textOf(answer.content)
      if (!text.trim()) return

      const results = turnResults(messages, tools)
      const { unknown } = checkText(text, factsOf(results))
      const leftover = (text.match(PSEUDONYM) ?? []).filter(p => !results.some(r => r.includes(p)))
      if (!unknown.length && !leftover.length) return

      LOG.warn(`Answer replaced (task ${cds.context?.['agent.task.id']}): not in the tool results:`, [...unknown, ...leftover])
      LOG.debug('Replaced answer (masked):', text)
      const replaced = new answer.constructor({
        id: answer.id,
        content: NOT_VERIFIED,
        response_metadata: answer.response_metadata,
        usage_metadata: answer.usage_metadata,
      })
      return { messages: [replaced] }
    },
  }
}
