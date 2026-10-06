// Claude steps of A2–A5 (blueprint §5.1, §5.2; development plan 6.1).
//
// Every agent stores its template recommendation first (phase 2). Once that
// transaction has committed, refineRecommendation() runs the agent's CAP
// agent service (@cap-js/agents) and, when the result passes the checks,
// replaces the recommendation's text with Claude's. The case flow never waits
// on the LLM, and nothing here changes a status.
//
// runAgent() is the call itself:
//   1. llm-mock (cds watch without a key) → the template, no call.
//   2. srv.chat(query) on the agent service, in a context of its own without a
//      transaction: a run takes seconds and the in-memory SQLite has one
//      connection, so the run must not hold it. The plugin writes its task
//      row and checkpoints in short transactions of their own.
//   3. Failed, timed-out or empty run → template, LLM_UNAVAILABLE; also a
//      cut-off answer or a refusal (stop reason max_tokens / refusal).
//   4. The emit_data_part data, validated against the agent's JSON schema
//      (ajv) → template, SCHEMA, when invalid or missing.
//   5. Number check (number-check.js) of every text field against the results
//      of this run's function calls → template, NUMBER_CHECK, on any unknown
//      number, date or ID, when a key fact (mustMention) is left out, or
//      when a pseudonym is left in the text unresolved.
//
// Notes on the plugin (0.9.7, spike in plan 6.0):
// - srv.chat returns the tool calls only with { _details: true }.
// - srv.chat writes no cap.agent.Tasks row by itself (the A2A handler does);
//   'agent.new.task' on the context makes the executor insert one, and the
//   final state is set here, because a row left in 'submitted' counts as a
//   running task for the plugin's quotas.
// - With masking, the tool results and emit_data_part's arguments carry
//   pseudonyms; emit_data_part's result has them resolved.

import cds from '@sap/cds'
import Ajv from 'ajv'
import { checkText, factsOf, missingIn } from './number-check.js'
import { recordAgentRun } from '../agents/feasibility-case-orchestrator/orchestrator.js'

const { UPDATE } = cds.ql
const LOG = cds.log('agents')

// Runs at the same time; the rest wait. A demo reset or a sales order with
// several items starts many runs at once.
const MAX_PARALLEL_RUNS = 2

// The plugin's pseudonyms: the element name and a hex hash, e.g. customerName-9e9444a2b952cae6.
// Our own IDs (FC-0001, FG-100, …) start upper case.
const PSEUDONYM = /\b[a-z][A-Za-z]*-[0-9a-f]{8,}\b/g

const ajv = new Ajv({ allErrors: true })
const validators = new WeakMap()

/** True when A2–A5 call Claude: cds.requires.llm is not llm-mock. */
export function llmEnabled() {
  const kind = cds.requires.llm?.kind ?? cds.requires.llm
  return !!kind && kind !== 'llm-mock' && kind !== 'mock'
}

// --- Helpers ----------------------------------------------------------------------

const privileged = () => new cds.EventContext({ user: cds.User.privileged })

/** The model of the agent's cds.requires entry (@agent.llm, default llm). */
const modelOf = srv => cds.requires[srv.definition?.['@agent.llm'] ?? 'llm']?.model ?? null

const versions = new Map()

/** `version` from the front matter of the AGENTS.md next to the agent's .cds file. */
function promptVersionOf(srv) {
  if (versions.has(srv.name)) return versions.get(srv.name)
  const { fs, path } = cds.utils
  const source = srv.definition?.$location?.file
  let version = null
  try {
    const persona = fs.readFileSync(path.join(cds.root, path.dirname(source), 'AGENTS.md'), 'utf8')
    version = /^---\r?\n[\s\S]*?^version:\s*(\S+)\s*$[\s\S]*?^---/m.exec(persona)?.[1] ?? null
  } catch {
    LOG.warn(`No AGENTS.md found for ${srv.name}`)
  }
  versions.set(srv.name, version)
  return version
}

function isValid(schema, data) {
  if (!validators.has(schema)) validators.set(schema, ajv.compile(schema))
  const validate = validators.get(schema)
  if (validate(data)) return true
  LOG.warn('Agent output does not match its schema:', ajv.errorsText(validate.errors))
  return false
}

/** The string fields of an output, at any depth. */
const textsOf = value =>
  typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(textsOf)
  : value && typeof value === 'object' ? Object.values(value).flatMap(textsOf)
  : []

/** Sets the plugin's task row to the run's final state (see the notes above). */
async function closeTask(taskId, state) {
  if (!taskId) return
  try {
    await cds._with(privileged(), () => UPDATE('cap.agent.Tasks').set({ state }).where({ taskId }))
  } catch (e) {
    LOG.warn(`Could not set the state of agent task ${taskId}:`, e.message)
  }
}

let running = 0
const waiting = []

/** Runs fn when fewer than MAX_PARALLEL_RUNS runs are going on. */
async function queued(fn) {
  if (running >= MAX_PARALLEL_RUNS) await new Promise(resolve => waiting.push(resolve))
  running++
  try {
    return await fn()
  } finally {
    running--
    waiting.shift()?.()
  }
}

// --- The call ---------------------------------------------------------------------

/**
 * Runs one Claude step of an agent.
 * agent:    the agent service name, e.g. 'SupplyInventoryAgentService'
 * query:    the message, e.g. 'Case FC-0001: explain the supply recommendation.'
 * schema:   JSON schema of the emit_data_part data
 * template: the template output in the same shape (the fallback)
 * render:   output → the text stored as the recommendation's rationale
 * mustMention: optional key facts the text must contain (dates, IDs, numbers)
 * Returns { output, text, llmUsed, fallbackReason, modelId, promptVersion,
 *           agentTaskId, toolCalls, inputSnapshot }; inputSnapshot holds the
 * results of the agent's function calls as Claude got them (masked).
 */
export async function runAgent({ agent, query, schema, template, render, mustMention = [] }) {
  const base = { output: template, text: render(template), llmUsed: false, fallbackReason: null, modelId: null, promptVersion: null, agentTaskId: null, toolCalls: [], inputSnapshot: null }
  if (!llmEnabled()) return base

  const srv = await cds.connect.to(agent)
  const ctx = privileged()
  let result, error
  try {
    result = await cds._with(ctx, () => {
      ctx['agent.new.task'] = true
      return srv.chat(query, { _details: true })
    })
  } catch (e) {
    error = e
  }
  const agentTaskId = result?.taskId ?? ctx['agent.task.id'] ?? null
  await closeTask(agentTaskId, error ? 'failed' : result.status)

  const functions = new Set(Object.keys(srv.actions ?? {}))
  const toolCalls = result?.toolCalls ?? []
  LOG.debug(`${agent} tool calls:`, toolCalls.map(c => `${c.tool}(${JSON.stringify(c.args).slice(0, 120)})`))
  const toolResults = toolCalls.filter(c => functions.has(c.tool)).map(({ tool, args, result }) => ({ tool, args, result }))
  const run = { ...base, modelId: modelOf(srv), promptVersion: promptVersionOf(srv), agentTaskId, toolCalls, inputSnapshot: toolResults.length ? toolResults : null }
  const fallback = (fallbackReason, ...details) => {
    LOG.warn(`${agent}: template text kept (${fallbackReason}) for "${query}"`, ...details)
    return { ...run, fallbackReason }
  }

  if (error || result.status !== 'completed') return fallback('LLM_UNAVAILABLE', error?.message ?? result.status)
  const emitted = toolCalls.filter(c => c.tool === 'emit_data_part').at(-1)
  const output = emitted?.result?.data ?? emitted?.args?.data
  if (!output && !result.text?.trim()) return fallback('LLM_UNAVAILABLE', 'empty answer')
  if (!output || !isValid(schema, output)) {
    // a cut-off answer or a refusal is the model's failure, not a wrong shape (§5.2)
    const stopped = result.messages?.map(m => m.response_metadata?.stop_reason).find(r => r === 'max_tokens' || r === 'refusal')
    return stopped ? fallback('LLM_UNAVAILABLE', `stop reason ${stopped}`) : fallback('SCHEMA')
  }

  // The text Claude wrote has the pseudonyms resolved, so the facts get them resolved too.
  const pseudonyms = ctx['agent.pseudonyms']
  const resolve = value => (typeof value === 'string' && pseudonyms ? pseudonyms.resolveText(value) : value)
  const facts = factsOf([query, ...toolResults.map(r => resolve(typeof r.result === 'string' ? r.result : JSON.stringify(r.result)))])
  const unknown = textsOf(output).flatMap(text => checkText(text, facts).unknown)
  if (unknown.length) return fallback('NUMBER_CHECK', 'not in the tool results:', unknown)
  const missing = missingIn(textsOf(output).join('\n'), mustMention)
  if (missing.length) return fallback('NUMBER_CHECK', 'key facts left out:', missing)
  // a pseudonym Claude changed cannot be resolved and would show up as it is
  const leftover = textsOf(output).flatMap(text => text.match(PSEUDONYM) ?? [])
  if (leftover.length) return fallback('NUMBER_CHECK', 'unresolved pseudonyms:', leftover)

  return { ...run, output, text: render(output), llmUsed: true }
}

/**
 * Puts Claude's text on a stored template recommendation, after the current
 * transaction has committed (plan 6.1). No-op with llm-mock.
 * job: { recommendationId, agent, query, schema, template, render, mustMention, apply }
 * apply(run): optional, runs in the transaction that stores the result, for
 * facts that follow from the output (A2's verified penalty rule).
 */
export function refineRecommendation(job) {
  if (!llmEnabled() || !job.recommendationId) return
  const start = () =>
    setImmediate(() =>
      cds._with(privileged(), async () => {
        try {
          const run = await queued(() => runAgent(job))
          await cds.tx(async () => {
            if (await recordAgentRun(job.recommendationId, run)) await job.apply?.(run)
          })
        } catch (e) {
          LOG.error(`${job.agent}: storing the agent text failed for "${job.query}":`, e)
        }
      }),
    )
  const ctx = cds.context
  if (ctx?.tx && !ctx.tx._done) ctx.on('succeeded', start)
  else start()
}
