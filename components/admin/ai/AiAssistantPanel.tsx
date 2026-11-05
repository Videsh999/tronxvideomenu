"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function AiAssistantPanel() {
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const message = input.trim();
    if (message.length < 2) return;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId }),
      });
      const json = (await response.json()) as {
        success: boolean;
        data?: { threadId: string; answer: string; figuresSource: string; tool: string };
        error?: string;
      };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error ?? "Assistant failed");
      setThreadId(json.data.threadId);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${json.data!.answer}\n\n(source: ${json.data!.figuresSource}, tool: ${json.data!.tool})`,
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assistant failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Ask about sales, dishes, stock, forecasts, or alerts. Answers use verified analytics tools only.
          </p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                msg.role === "user" ? "bg-neutral-100 text-neutral-900" : "bg-neutral-900 text-white"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="e.g. Which dishes sold the most this week?"
          className="h-11 flex-1 rounded-xl border border-neutral-300 px-3 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
