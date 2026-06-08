import type { Message } from '../../types/conversation';

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="考え中">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isPending = message.role === 'assistant' && message.content === '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'rounded-br-md bg-accent-600/90 text-white'
            : 'rounded-bl-md bg-surface-2 text-zinc-100'
        }`}
      >
        {isPending ? (
          <TypingDots />
        ) : (
          <p className="jp-text whitespace-pre-wrap break-words text-[1.05rem]">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}
