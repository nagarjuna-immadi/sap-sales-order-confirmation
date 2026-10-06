// Fixes for the masking middleware of @cap-js/agents 0.9.7 (development plan 6.0).
// Only agents with @PersonalData fields are masked, so A2 and A5.
//
// 1. The plugin masks every tool, also the deep agent's own file tools. A
//    skill file the agent reads (read_file) is then decoded as TOON and
//    re-encoded, so Claude gets a mangled text and reads it again and again.
//    Skill files and directory listings hold no personal data: only the
//    service's own functions (whose results carry the @PersonalData fields)
//    and emit_data_part (whose pseudonyms are resolved on the way in) go
//    through the masking.
// 2. When a function result is neither TOON nor JSON (an error such as
//    "Customer … not found"), the masking puts the scrubbed text into the
//    graph state as a plain string instead of a ToolMessage. Claude then gets
//    a tool call without its result and the run fails with a 400 ("tool_use
//    ids were found without tool_result blocks"). Such a string goes back
//    into a copy of the tool's own ToolMessage, as the plugin does for
//    decoded results.
//
// Register it in each agent service: this.after('buildMiddleware', fixMasking(this))
// Remove it once the plugin fixes both.

/** The ToolMessage inside a tool handler's result (a ToolMessage or a Command). */
const toolMessageOf = result => (typeof result?.tool_call_id === 'string' ? result : result?.update?.messages?.find(m => typeof m?.tool_call_id === 'string'))

/** After-handler of buildMiddleware for `srv`: patches the masking middleware in place. */
export function fixMasking(srv) {
  return middleware => {
    const masking = Array.isArray(middleware) && middleware.find(m => m?.name === 'masking')
    if (!masking?.wrapToolCall || masking._fixed) return
    const masked = new Set([...Object.keys(srv.actions ?? {}), 'emit_data_part'])
    const wrapToolCall = masking.wrapToolCall
    masking.wrapToolCall = async (request, handler) => {
      if (!masked.has(request.toolCall?.name)) return handler(request)
      let original
      const result = await wrapToolCall(request, async req => (original = await handler(req)))
      const messages = result?.update?.messages
      const toolMessage = toolMessageOf(original)
      if (Array.isArray(messages) && toolMessage) {
        messages.forEach((message, i) => {
          if (typeof message === 'string') messages[i] = new toolMessage.constructor({ ...toolMessage, content: message })
        })
      }
      return result
    }
    masking._fixed = true
  }
}
