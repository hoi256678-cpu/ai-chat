import type { RefObject } from "react";
import type { StoredMessage } from "@/lib/chatHistory";

export function ChatMessages({
  messages,
  loading,
  emptyText,
  bottomRef,
}: {
  messages: StoredMessage[];
  loading?: boolean;
  emptyText?: string;
  bottomRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
      {messages.length === 0 && emptyText && (
        <p className="pt-10 text-center text-sm text-sub">{emptyText}</p>
      )}

      {messages.map((message, index) => {
        const isAssistant = message.role === "assistant";
        const isFirstInGroup = messages[index - 1]?.role !== message.role;
        const isLastInGroup = messages[index + 1]?.role !== message.role;

        return (
          <div
            key={index}
            className={
              isAssistant
                ? "flex items-end gap-2"
                : "flex items-end justify-end gap-2"
            }
          >
            {isAssistant && (
              <div
                className="orb-mark h-7 w-7 shrink-0 self-end"
                style={{ visibility: isFirstInGroup ? "visible" : "hidden" }}
                aria-hidden
              />
            )}

            <div
              className={
                isAssistant
                  ? "order-2 max-w-[75%] rounded-2xl rounded-bl-md bg-bubble-other px-4 py-2.5 text-[15px] leading-relaxed text-ink shadow-[0_1px_2px_rgba(22,33,44,0.06)]"
                  : "max-w-[75%] rounded-2xl rounded-br-md bg-bubble-mine px-4 py-2.5 text-[15px] leading-relaxed text-ink"
              }
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>

            {isLastInGroup && (
              <span
                className={
                  isAssistant
                    ? "order-3 mb-0.5 shrink-0 text-[11px] text-sub"
                    : "mb-0.5 shrink-0 text-[11px] text-sub"
                }
              >
                {message.time}
              </span>
            )}
          </div>
        );
      })}

      {loading && (
        <div className="flex items-end gap-2">
          <div className="orb-mark h-7 w-7 shrink-0 self-end" aria-hidden />
          <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-bubble-other px-4 py-2.5 text-[15px] text-sub shadow-[0_1px_2px_rgba(22,33,44,0.06)]">
            생각하는 중…
          </div>
        </div>
      )}

      {bottomRef && <div ref={bottomRef} />}
    </div>
  );
}
