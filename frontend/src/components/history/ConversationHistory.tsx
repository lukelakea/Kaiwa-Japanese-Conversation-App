import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

import { backdropVariants } from '../../config/motion';
import type { SavedConversation } from '../../types/history';
import { CloseIcon, TrashIcon } from '../ui/icons';

interface ConversationHistoryProps {
  open: boolean;
  onClose: () => void;
  conversations: SavedConversation[];
  onRestore: (conversation: SavedConversation) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
}

const leftDrawerVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } },
  exit: { x: '-100%', transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
};

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Older'] as const;

function dateGroup(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This week';
  return 'Older';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ConversationHistory({
  open,
  onClose,
  conversations,
  onRestore,
  onDelete,
  activeId,
}: ConversationHistoryProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const grouped = new Map<string, SavedConversation[]>();
  for (const conv of conversations) {
    const g = dateGroup(conv.updatedAt);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(conv);
  }
  const groups = GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => ({
    label: g,
    items: grouped.get(g)!,
  }));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-label="Conversation history"
            variants={leftDrawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-0 flex h-full w-full max-w-xs flex-col border-r border-border bg-surface-1 shadow-lg"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-200">History</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close history"
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>

            {conversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">
                No conversations yet. Start chatting — they'll save here automatically.
              </p>
            ) : (
              <ul className="flex-1 overflow-y-auto py-2">
                {groups.map(({ label, items }) => (
                  <li key={label}>
                    <p className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-600">
                      {label}
                    </p>
                    {items.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={conv.id === activeId}
                        onRestore={() => {
                          onRestore(conv);
                          onClose();
                        }}
                        onDelete={(e) => {
                          e.stopPropagation();
                          onDelete(conv.id);
                        }}
                      />
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onRestore,
  onDelete,
}: {
  conversation: SavedConversation;
  isActive: boolean;
  onRestore: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const msgCount = conversation.messages.length;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRestore}
      onKeyDown={(e) => e.key === 'Enter' && onRestore()}
      className={`group flex cursor-pointer items-start justify-between gap-2 border-l-2 px-4 py-2.5 transition-colors hover:bg-white/5 ${
        isActive ? 'border-accent-500 bg-white/5' : 'border-transparent'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-200">{conversation.title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {formatDate(conversation.updatedAt)} · {msgCount} message{msgCount !== 1 ? 's' : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete "${conversation.title}"`}
        className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-all hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
