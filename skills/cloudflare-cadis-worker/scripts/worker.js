var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// cadis-ai-gateway.worker.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        provider: "cloudflare-workers-ai",
        models: Object.keys(MODEL_MAP).length
      }), { headers: { "Content-Type": "application/json" } });
    }
    if (path === "/v1/models" && request.method === "GET") {
      return listModels();
    }
    if (path === "/v1/chat/completions" && request.method === "POST") {
      return handleChatCompletion(request, env, ctx);
    }
    if (path === "/v1/embeddings" && request.method === "POST") {
      return handleEmbedding(request, env);
    }
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
};
var RELIABLE_TOOL_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Vision lane - any request carrying image_url parts routes to the vision
// model, and the image stays INLINE in the message content (the top-level
// `image` param fails with 3030 "no user-supplied messages" when content is
// string-only). Remote image URLs are inlined to base64 data URLs server-side
// (max 3, 12MB each) because the backing model cannot fetch remote URLs. A
// vision request can therefore never silently degrade to a text-only model.
var VISION_CF_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
var MODEL_MAP = {
  // Tier 1 — Speed (fast, cheap)
  "cadis-fast": "@cf/meta/llama-3.2-3b-instruct",
  "cadis-light": "@cf/moonshotai/kimi-k2.6",
  // Tier 2 — Code (specialized)
  "cadis-code": "@cf/qwen/qwen2.5-coder-32b-instruct",
  "cadis-kimi": "@cf/moonshotai/kimi-k2.7-code",
  // Tier 3 — Reasoning (deep thinking)
  "cadis-reasoning": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "cadis-qwq": "@cf/qwen/qwq-32b",
  // Tier 4 — Heavy (large context, complex tasks)
  "cadis-plus": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "cadis-gemma": "@cf/google/gemma-4-26b-a4b-it",
  // Tier 5 — Vision (image understanding; image passed as top-level `image` param)
  "cadis-vision": VISION_CF_MODEL,
  // Default — general purpose
  "cadis": "@cf/meta/llama-3.2-3b-instruct",
  // Passthrough — allow direct Cloudflare model names
  "llama-3.2-3b": "@cf/meta/llama-3.2-3b-instruct",
  "llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct-fp8",
  "deepseek-r1": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "qwen-coder": "@cf/qwen/qwen2.5-coder-32b-instruct"
};
function resolveModel(requested) {
  const clean = String(requested || "").trim().toLowerCase();
  return MODEL_MAP[clean] || MODEL_MAP["cadis"];
}
__name(resolveModel, "resolveModel");
__name2(resolveModel, "resolveModel");
var MODEL_LIST = Object.keys(MODEL_MAP).map((id) => ({
  id,
  object: "model",
  owned_by: "genius-substrates"
}));
function listModels() {
  return new Response(JSON.stringify({
    object: "list",
    data: MODEL_LIST
  }), { headers: { "Content-Type": "application/json" } });
}
__name(listModels, "listModels");
__name2(listModels, "listModels");
async function handleChatCompletion(request, env, ctx) {
  try {
    const body = await request.json();
    const requestedModel = body.model || "cadis";
    let cfModel = resolveModel(requestedModel);
    var stream2 = body.stream === true;
    const cfTools = toCloudflareTools(body.tools);
    if (cfTools) {
      cfModel = RELIABLE_TOOL_MODEL;
    }
    // Vision: any request carrying image_url parts routes to the vision model
    // (unless tools are present, which require the reliable text model). The
    // image stays INLINE in the message content — this model rejects the
    // top-level `image` param with 3030 when content is string-only. Remote
    // image URLs are inlined to base64 data URLs server-side (max 3, 4.5MB
    // each) because the backing model cannot fetch remote URLs itself.
    const hasImage = messagesHaveImage(body.messages || []);
    if (hasImage && !cfTools) cfModel = VISION_CF_MODEL;
    var modelBudget = cfModel === RELIABLE_TOOL_MODEL ? TOOL_MODEL_BUDGET_TOKENS : LARGE_WINDOW_BUDGET_TOKENS;
    const preserveImages = hasImage && !cfTools && cfModel === VISION_CF_MODEL;
    const input = {
      model: cfModel,
      messages: preserveImages
        ? await inlineVisionMessages(body.messages || [])
        : trimToBudget(normalizeMessages(body.messages || []), cfTools, modelBudget),
      max_tokens: body.max_tokens ?? 4096,
      temperature: body.temperature ?? 0.7,
      top_p: body.top_p ?? 1,
      stream: stream2,
      ...cfTools ? { tools: cfTools } : {}
    };
    const start = Date.now();
    const gatewayMetadata = {};
    const workspaceId = request.headers.get("x-genius-workspace-id");
    const developerEmail = request.headers.get("x-genius-developer-email");
    if (workspaceId) gatewayMetadata.workspace = workspaceId;
    if (developerEmail) gatewayMetadata.developer = developerEmail;
    const gatewayOptions = Object.keys(gatewayMetadata).length ? { id: "cadis-gateway", metadata: gatewayMetadata } : { id: "cadis-gateway" };
    console.log(`[cadis] ${requestedModel} \u2192 ${cfModel} stream=${stream2} workspace=${workspaceId || "-"} developer=${developerEmail || "-"}`);
    if (stream2) {
      let aiStream;
      try {
        aiStream = await env.AI.run(cfModel, {
          ...input,
          stream: true
        }, { gateway: gatewayOptions });
      } catch (streamErr) {
        console.error("[cadis] stream init error:", streamErr.message);
        const body2 = "data: " + JSON.stringify({ error: { message: String(streamErr.message || "upstream inference failed"), type: "cadis_error", retryable: false } }) + "\n\ndata: [DONE]\n\n";
        setTimeout(() => {
        }, 0);
        return new Response(body2, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
        });
      }
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      ctx.waitUntil(pumpSSE(aiStream, writer, encoder, cfModel, Boolean(cfTools)));
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Model": cfModel
        }
      });
    } else {
      const result = await env.AI.run(cfModel, input, { gateway: gatewayOptions });
      const elapsed = Date.now() - start;
      const toolCalls = toOpenAIToolCalls(result?.tool_calls);
      const rawContent = result.response ?? result ?? "";
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      const message = toolCalls ? { role: "assistant", content: null, tool_calls: toolCalls } : { role: "assistant", content: contentStr };
      return new Response(JSON.stringify({
        id: `cadis-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1e3),
        model: requestedModel,
        choices: [{
          index: 0,
          message,
          finish_reason: toolCalls ? "tool_calls" : "stop"
        }],
        usage: {
          prompt_tokens: -1,
          completion_tokens: -1,
          total_tokens: -1
        },
        _meta: { cfModel, elapsedMs: elapsed }
      }), { headers: { "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("[cadis] chat error:", err.message);
    if (stream2) {
      const msg = JSON.stringify({ error: { message: String(err.message), type: "cadis_error", retryable: false } });
      return new Response("data: " + msg + "\n\ndata: [DONE]\n\n", {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }
    return new Response(JSON.stringify({
      error: { message: err.message, type: "cadis_error" }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleChatCompletion, "handleChatCompletion");
__name2(handleChatCompletion, "handleChatCompletion");
function sseChunk(id, model, delta, finishReason) {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1e3),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }]
  };
}
__name(sseChunk, "sseChunk");
__name2(sseChunk, "sseChunk");
async function pumpSSE(aiStream, writer, encoder, model, hasTools) {
  let fullText = "";
  const toolCallAcc = {};
  try {
    const reader = aiStream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let text = "";
        let deltaToolCalls = null;
        try {
          const parsed = JSON.parse(payload);
          const raw = parsed?.response ?? parsed?.choices?.[0]?.delta?.content;
          text = raw === void 0 || raw === null ? "" : String(raw);
          deltaToolCalls = parsed?.choices?.[0]?.delta?.tool_calls;
        } catch {
          continue;
        }
        // Reproduced live 2026-08-18: this model streams tool calls as
        // structured OpenAI-shape `delta.tool_calls` fragments (index,
        // optional id/type, function.name on the first fragment,
        // function.arguments incrementally across later fragments) with
        // `delta.content` staying "" the entire time -- never as a single
        // JSON blob inside content text. The only tool-call handling below
        // this point used to be tryParseStreamedToolCall(fullText), which
        // only recognizes a tool call written out as literal JSON text --
        // it never looked at delta.tool_calls at all, so fullText stayed
        // empty, nothing matched, and the turn silently finished as "stop"
        // with no content and no tool call, forever. Accumulate the
        // structured fragments here (arguments are a partial string per
        // fragment, concatenated by index) so the done-branch below has a
        // real tool call to emit instead of nothing.
        if (hasTools && Array.isArray(deltaToolCalls)) {
          for (const tc of deltaToolCalls) {
            const idx = tc?.index ?? 0;
            if (!toolCallAcc[idx]) toolCallAcc[idx] = { id: tc?.id || `call_${Date.now()}_${idx}`, name: "", arguments: "" };
            if (tc?.id) toolCallAcc[idx].id = tc.id;
            if (tc?.function?.name) toolCallAcc[idx].name += tc.function.name;
            if (tc?.function?.arguments) toolCallAcc[idx].arguments += tc.function.arguments;
          }
        }
        if (!text.length) continue;
        if (hasTools) {
          fullText += text;
          continue;
        }
        await writer.write(encoder.encode(`data: ${JSON.stringify(
          sseChunk(`cadis-ss-${Date.now()}`, model, { content: text }, null)
        )}

`));
      }
      if (done) {
        if (hasTools) {
          const accCalls = Object.values(toolCallAcc).filter((c) => c.name).map((c, i) => ({
            index: i,
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.arguments || "{}" }
          }));
          const toolCall = accCalls.length ? null : tryParseStreamedToolCall(fullText);
          if (accCalls.length) {
            await writer.write(encoder.encode(`data: ${JSON.stringify(
              sseChunk(`cadis-ss-${Date.now()}`, model, { tool_calls: accCalls }, null)
            )}

`));
            await writer.write(encoder.encode(`data: ${JSON.stringify(
              sseChunk(`cadis-ss-${Date.now()}`, model, {}, "tool_calls")
            )}

`));
          } else if (toolCall) {
            const callId = `call_${Date.now()}_0`;
            await writer.write(encoder.encode(`data: ${JSON.stringify(
              sseChunk(`cadis-ss-${Date.now()}`, model, {
                tool_calls: [{
                  index: 0,
                  id: callId,
                  type: "function",
                  function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) }
                }]
              }, null)
            )}

`));
            await writer.write(encoder.encode(`data: ${JSON.stringify(
              sseChunk(`cadis-ss-${Date.now()}`, model, {}, "tool_calls")
            )}

`));
          } else {
            if (fullText.length) {
              await writer.write(encoder.encode(`data: ${JSON.stringify(
                sseChunk(`cadis-ss-${Date.now()}`, model, { content: fullText }, null)
              )}

`));
            }
            await writer.write(encoder.encode(`data: ${JSON.stringify(
              sseChunk(`cadis-ss-${Date.now()}`, model, {}, "stop")
            )}

`));
          }
        } else {
          await writer.write(encoder.encode(`data: ${JSON.stringify(
            sseChunk(`cadis-ss-${Date.now()}`, model, {}, "stop")
          )}

`));
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
        break;
      }
    }
  } catch (err) {
    console.error("[cadis] SSE pump error:", err.message);
    await writer.write(encoder.encode(`data: ${JSON.stringify({ error: err.message })}

`));
    await writer.write(encoder.encode("data: [DONE]\n\n"));
  } finally {
    try {
      await writer.close();
    } catch (_) {
    }
  }
}
__name(pumpSSE, "pumpSSE");
__name2(pumpSSE, "pumpSSE");
async function handleEmbedding(request, env) {
  try {
    const body = await request.json();
    const input = body.input;
    if (!input) {
      return new Response(JSON.stringify({ error: "input required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const result = await env.AI.run("@cf/baai/bge-m3", {
      text: Array.isArray(input) ? input : [input]
    }, { gateway: { id: "cadis-gateway" } });
    const embeddings = result.data.map((vec, i) => ({
      object: "embedding",
      embedding: vec,
      index: i
    }));
    return new Response(JSON.stringify({
      object: "list",
      data: embeddings,
      model: "bge-m3",
      usage: { prompt_tokens: -1, total_tokens: -1 }
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[cadis] embedding error:", err.message);
    return new Response(JSON.stringify({
      error: { message: err.message, type: "cadis_error" }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleEmbedding, "handleEmbedding");
__name2(handleEmbedding, "handleEmbedding");
function toCloudflareTools(openaiTools) {
  if (!Array.isArray(openaiTools) || !openaiTools.length) return null;
  return openaiTools.map((t) => t?.type === "function" && t.function ? t.function : t).filter((f) => f && f.name).map((f) => ({
    name: f.name,
    description: f.description || "",
    parameters: f.parameters || { type: "object", properties: {} }
  }));
}
__name(toCloudflareTools, "toCloudflareTools");
__name2(toCloudflareTools, "toCloudflareTools");
function toOpenAIToolCalls(cfToolCalls) {
  if (!Array.isArray(cfToolCalls) || !cfToolCalls.length) return null;
  return cfToolCalls.map((tc, i) => ({
    id: `call_${Date.now()}_${i}`,
    type: "function",
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.arguments ?? {})
    }
  }));
}
__name(toOpenAIToolCalls, "toOpenAIToolCalls");
__name2(toOpenAIToolCalls, "toOpenAIToolCalls");
function tryParseStreamedToolCall(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const name = parsed?.name || parsed?.function?.name;
  const args = parsed?.arguments ?? parsed?.parameters ?? parsed?.function?.arguments;
  if (!name || typeof args !== "object" || args === null) return null;
  return { name, arguments: args };
}
__name(tryParseStreamedToolCall, "tryParseStreamedToolCall");
__name2(tryParseStreamedToolCall, "tryParseStreamedToolCall");
// Was 17000 -- with a real system prompt (~3300 tokens) and a real 34-tool
// catalog, fixed overhead alone was already brushing this ceiling before a
// single conversation message existed, forcing the trim loop below to
// activate on nearly every request. Raised to 19000: the gateway's real
// enforced ceiling is 24000 and output is capped at 4096 (see
// seed-cadis-config.js in genius-ide), so 19000 input + 4096 output stays
// safely under with margin, while trimming less aggressively than before.
var TOOL_MODEL_BUDGET_TOKENS = 19e3;
var LARGE_WINDOW_BUDGET_TOKENS = 1e5;
var CHARS_PER_TOKEN = 3.5;
function estimateContentTokens(content) {
  if (typeof content === "string") return Math.ceil(content.length / CHARS_PER_TOKEN);
  if (Array.isArray(content)) {
    return content.reduce(function(acc, p) {
      if (p && p.type === "text" && typeof p.text === "string") return acc + Math.ceil(p.text.length / CHARS_PER_TOKEN);
      if (p && p.type === "image_url" && p.image_url && typeof p.image_url.url === "string") return acc + 85;
      return acc;
    }, 0);
  }
  return 0;
}
__name(estimateContentTokens, "estimateContentTokens");
function estimateToolsTokens(tools) {
  if (!Array.isArray(tools) || !tools.length) return 0;
  var raw = JSON.stringify(tools);
  return Math.ceil(raw.length / CHARS_PER_TOKEN) + 8;
}
__name(estimateToolsTokens, "estimateToolsTokens");
function truncateTextApprox(text, estTargetTokens, keep) {
  var targetChars = Math.max(0, Math.floor(estTargetTokens * CHARS_PER_TOKEN));
  if (text.length <= targetChars) return text;
  return keep === "back" ? text.slice(text.length - targetChars) : text.slice(0, targetChars);
}
__name(truncateTextApprox, "truncateTextApprox");
function trimToBudget(messages, tools, budgetTokens) {
  if (!Array.isArray(messages) || !messages.length) return messages;
  var budget = budgetTokens || TOOL_MODEL_BUDGET_TOKENS;
  var toolsTok = estimateToolsTokens(tools);
  var used = toolsTok;
  var i;
  for (i = 0; i < messages.length; i++) used += estimateContentTokens(messages[i].content);
  if (used <= budget) return messages;
  var out = messages.slice();
  // Reproduced live 2026-08-19: this loop only ever protected index 0
  // (system) and the last message -- everything in between, including the
  // user's ORIGINAL TASK, was eligible for deletion. Once fixed overhead
  // (system prompt + a real tool catalog) already exceeds budget on its
  // own -- routine with 30+ real tools -- this loop ran to completion and
  // left only [system, <whatever the last message happened to be>], which
  // during an active tool-call loop is a bare, often-empty tool-result
  // stub. The model then genuinely had no idea what task it was doing,
  // which explains a whole class of "called an unrelated tool" incidents
  // that had nothing to do with tool-catalog size or model choice -- the
  // task itself was silently erased before the model ever saw the request.
  // Fix: also protect the first user-role message, so the task can never
  // be trimmed away; only older intermediate content (tool calls/results)
  // is still eligible, same as before.
  var firstUserIdx = -1;
  for (i = 0; i < out.length; i++) { if (out[i].role === "user") { firstUserIdx = i; break; } }
  var protectedIdx = firstUserIdx >= 0 ? firstUserIdx : 0;
  var idx = 1;
  while (idx < out.length - 1 && used > budget) {
    if (idx === protectedIdx) { idx++; continue; }
    var dropTok = estimateContentTokens(out[idx].content);
    used -= dropTok;
    out.splice(idx, 1);
    if (protectedIdx > idx) protectedIdx--; // indices after the splice point shift down
    if (dropTok === 0 && idx >= out.length - 1) break;
  }
  var guard = 0;
  while (used > budget && guard++ < 50) {
    var big = -1, bigTok = 0;
    var lastIdx = out.length - 1;
    for (i = 1; i < out.length; i++) {
      // Reproduced live 2026-08-19, same incident as the drop-loop fix above:
      // protectedIdx survived deletion but this loop still picked it as the
      // "biggest" remaining message once everything else had already been
      // trimmed down (a real user task is often the smallest message in the
      // conversation, but once tool-call/result bulk is gone it can become
      // the ONLY one left, hence "biggest" among what remains) and truncated
      // its content down to "" -- same end result as deleting it outright.
      if (i === protectedIdx) continue;
      // Second occurrence of the exact same bug, reproduced live 2026-08-19
      // in a real multi-step build (write index.html -> write again ->
      // "File already exists. Use edit tool instead." repeated 5+ times):
      // the LAST message is always the most recent tool result in an active
      // tool-calling loop -- the one piece of feedback the model needs to
      // course-correct. This loop had no protection for it at all and could
      // truncate it to "" exactly like it did to the user message before
      // that fix. The model kept blindly retrying the same failed write
      // because it never actually received the error telling it to stop.
      if (i === lastIdx) continue;
      var t = estimateContentTokens(out[i].content);
      if (t > bigTok) {
        bigTok = t;
        big = i;
      }
    }
    if (big === -1 || bigTok <= 0) break;
    var cutTok = Math.min(bigTok, used - budget + 4);
    var isLast = big === out.length - 1;
    out[big].content = truncateTextApprox(
      Array.isArray(out[big].content) ? out[big].content : String(out[big].content),
      Math.floor(cutTok * 0.6),
      isLast ? "front" : "back"
    );
    used -= bigTok - estimateContentTokens(out[big].content);
  }
  return out;
}
__name(trimToBudget, "trimToBudget");
__name2(trimToBudget, "trimToBudget");
async function inlineVisionImage(url) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url) || /^https?:\/\/[^/]*data/.test(url)) return url;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    const mime = res.headers.get("content-type") || "image/jpeg";
    console.log(`[cadis] inlineVisionImage ${res.status} ${mime}`);
    if (!mime.startsWith("image/")) return url;
    const buf = await res.arrayBuffer();
    console.log(`[cadis] inlineVisionImage bytes=${buf.byteLength}`);
    if (buf.byteLength > 12 * 1024 * 1024) return url;
    let bin = "";
    const bytes = new Uint8Array(buf);
    const chunk = 32768;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    const out = `data:${mime};base64,${btoa(bin)}`;
    console.log(`[cadis] inlineVisionImage ok len=${out.length}`);
    return out;
  } catch (e) {
    console.log(`[cadis] inlineVisionImage failed: ${e.message}`);
    return url;
  }
}
__name(inlineVisionImage, "inlineVisionImage");
__name2(inlineVisionImage, "inlineVisionImage");
function messagesHaveImage(messages) {
  if (!Array.isArray(messages)) return false;
  for (const m of messages) {
    if (!m || !Array.isArray(m.content)) continue;
    for (const p of m.content) {
      if (p && p.type === "image_url" && p.image_url) {
        const u = typeof p.image_url === "object" ? p.image_url.url : p.image_url;
        if (typeof u === "string" && u.length > 0) return true;
      }
    }
  }
  return false;
}
__name(messagesHaveImage, "messagesHaveImage");
__name2(messagesHaveImage, "messagesHaveImage");
async function inlineVisionMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  let imageCount = 0;
  const out = [];
  for (const m of messages) {
    if (!m || !Array.isArray(m.content)) { out.push(m); continue; }
    const parts = [];
    for (const p of m.content) {
      if (p && p.type === "image_url" && p.image_url) {
        const u = typeof p.image_url === "object" ? p.image_url.url : p.image_url;
        if (typeof u === "string" && u.length > 0 && imageCount < 3) {
          parts.push({ type: "image_url", image_url: { url: await inlineVisionImage(u) } });
          imageCount++;
        }
        continue;
      }
      parts.push(p);
    }
    out.push({ role: m.role, content: parts });
  }
  return out;
}
__name(inlineVisionMessages, "inlineVisionMessages");
__name2(inlineVisionMessages, "inlineVisionMessages");
function normalizeMessages(messages) {
  return messages.map((m) => {
    if (typeof m.content === "string") return m;
    if (Array.isArray(m.content)) {
      const textParts = m.content.filter((p) => p.type === "text").map((p) => p.text);
      return { role: m.role, content: textParts.join("\n") };
    }
    return m;
  });
}
__name(normalizeMessages, "normalizeMessages");
__name2(normalizeMessages, "normalizeMessages");
export {
  worker_default as default
};
//# sourceMappingURL=cadis-ai-gateway.worker.js.map




