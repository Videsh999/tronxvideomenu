import { z } from "zod";
import {
  ANALYTICS_TOOL_NAMES,
  analyticsToolCallSchema,
  type AnalyticsToolCall,
} from "@/lib/analytics/tools";

export type AiChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiCompletionResult = {
  content: string;
  toolCall?: AnalyticsToolCall;
  usage?: { promptTokens?: number; completionTokens?: number };
  provider: string;
  model: string;
  estimatedCostUsd?: number;
};

export interface AiProvider {
  complete(params: {
    messages: AiChatMessage[];
    timeoutMs?: number;
  }): Promise<AiCompletionResult>;
}

const toolJsonSchema = z.object({
  tool: z.enum(ANALYTICS_TOOL_NAMES),
  args: z.record(z.string(), z.unknown()).optional(),
  reply: z.string().optional(),
});

function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  // Rough GPT-4o-mini class estimate; logged for ops awareness only.
  return Number(((promptTokens * 0.00000015 + completionTokens * 0.0000006) ).toFixed(6));
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    private readonly config: {
      apiKey: string;
      baseUrl: string;
      model: string;
      providerName: string;
    },
  ) {}

  async complete(params: {
    messages: AiChatMessage[];
    timeoutMs?: number;
  }): Promise<AiCompletionResult> {
    const timeoutMs = params.timeoutMs ?? 12_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: params.messages,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AI provider HTTP ${response.status}`);
      }
      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      const promptTokens = json.usage?.prompt_tokens;
      const completionTokens = json.usage?.completion_tokens;
      let toolCall: AnalyticsToolCall | undefined;
      try {
        const parsed = toolJsonSchema.parse(JSON.parse(content));
        toolCall = analyticsToolCallSchema.parse({
          tool: parsed.tool,
          args: parsed.args ?? {},
        });
      } catch {
        toolCall = undefined;
      }
      return {
        content,
        toolCall,
        usage: { promptTokens, completionTokens },
        provider: this.config.providerName,
        model: this.config.model,
        estimatedCostUsd:
          promptTokens != null && completionTokens != null
            ? estimateCostUsd(promptTokens, completionTokens)
            : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Heuristic tool picker used when no API key is configured (deterministic fallback). */
export class HeuristicAiProvider implements AiProvider {
  async complete(params: { messages: AiChatMessage[] }): Promise<AiCompletionResult> {
    const lastUser = [...params.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lower = lastUser.toLowerCase();
    let tool: AnalyticsToolCall["tool"] = "sales_summary";
    if (/forecast|tomorrow|next\s+week|predict/.test(lower)) tool = "forecast_summary";
    else if (/reorder|stockout|days of stock|inventory recommend/.test(lower))
      tool = "inventory_recommendations";
    else if (/low stock|running low/.test(lower)) tool = "inventory_low_stock";
    else if (/wastage|waste/.test(lower)) tool = "inventory_wastage";
    else if (/star|plowhorse|puzzle|dog|menu intelligence/.test(lower)) tool = "menu_intelligence";
    else if (/margin|profitab|food cost/.test(lower)) tool = "menu_margins";
    else if (/inactive|not visited|lapsed|not ordered/.test(lower)) tool = "crm_inactive_customers";
    else if (/compare|last week|decrease|drop/.test(lower)) tool = "sales_compare_periods";
    else if (/top\s+(selling\s+)?dish|best.?sell|sold the most|highest revenue/.test(lower))
      tool = "sales_by_dish";
    else if (/outlet|branch perform/.test(lower)) tool = "outlet_comparison";
    else if (/alert/.test(lower)) tool = "list_alerts";

    const args: AnalyticsToolCall["args"] = {};
    if (tool === "sales_compare_periods") {
      const to = new Date();
      const from = new Date(to.getTime() - 7 * 86_400_000);
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - 7 * 86_400_000);
      args.from = from.toISOString();
      args.to = to.toISOString();
      args.previousFrom = prevFrom.toISOString();
      args.previousTo = prevTo.toISOString();
    } else if (tool === "forecast_summary") {
      args.horizon = /30/.test(lower) ? "NEXT_30_DAYS" : /tomorrow/.test(lower) ? "TOMORROW" : "NEXT_7_DAYS";
    }

    return {
      content: JSON.stringify({ tool, args, reply: "Using deterministic tool selection (no LLM key)." }),
      toolCall: { tool, args },
      provider: "heuristic",
      model: "heuristic-v1",
    };
  }
}

export function createAiProvider(): AiProvider {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return new HeuristicAiProvider();
  const providerName = process.env.AI_PROVIDER?.trim() || "openai";
  const baseUrl =
    process.env.AI_BASE_URL?.trim() ||
    (providerName === "gateway" ? "https://ai-gateway.vercel.sh/v1" : "https://api.openai.com/v1");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  return new OpenAiCompatibleProvider({ apiKey, baseUrl, model, providerName });
}
