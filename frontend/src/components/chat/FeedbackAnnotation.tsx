import { type ReactNode, useState } from 'react';

import { useSavedGrammarContext } from '../../context/SavedGrammarContext';
import type { Message } from '../../types/conversation';
import type { Feedback, FeedbackLabel } from '../../types/feedback';
import { BookmarkIcon, ChatIcon, CheckIcon, ChevronRightIcon } from '../ui/icons';
import { TranslationText } from './TranslationText';

interface FeedbackAnnotationProps {
  message: Message;
  showTranslation: boolean;
  onRetry: () => void;
  onRetryCorrectionTranslation: () => void;
  /** Optional element rendered to the right of the feedback trigger row (e.g. edit button). */
  trailingAction?: ReactNode;
}

/**
 * Collapsible per-message feedback (brief §8). Attached to the user's own
 * message and collapsed by default so the conversation reads naturally; the
 * affordance expands on demand to show the English explanation, the corrected
 * Japanese, and — for grammar corrections — a save action (brief §7).
 */
export function FeedbackAnnotation({
  message,
  showTranslation,
  onRetry,
  onRetryCorrectionTranslation,
  trailingAction,
}: FeedbackAnnotationProps) {
  const [expanded, setExpanded] = useState(false);

  if (message.feedbackStatus === 'loading') {
    return (
      <div className="mt-1 flex items-center gap-2 px-1">
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <ChatIcon className="h-3.5 w-3.5" />
          Checking…
        </p>
        {trailingAction}
      </div>
    );
  }

  if (message.feedbackStatus === 'error') {
    return (
      <div className="mt-1 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={onRetry}
          className="text-xs text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-300"
        >
          Feedback unavailable — retry
        </button>
        {trailingAction}
      </div>
    );
  }

  const feedback = message.feedback;
  if (!feedback) return null;

  const { acceptable } = feedback;

  return (
    <div className="mt-1 w-full max-w-[80%]">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
            acceptable
              ? 'text-emerald-400/80 hover:bg-emerald-400/10'
              : 'text-amber-400/90 hover:bg-amber-400/10'
          }`}
        >
          {acceptable ? <CheckIcon className="h-3.5 w-3.5" /> : <ChatIcon className="h-3.5 w-3.5" />}
          <span>{acceptable ? 'Looks good' : 'Suggestion'}</span>
          {!acceptable && feedback.labels.length > 0 && (
            <span className="flex gap-1">
              {feedback.labels.map((label) => (
                <LabelChip key={label} label={label} />
              ))}
            </span>
          )}
          <ChevronRightIcon
            className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
        {trailingAction}
      </div>

      {expanded && (
        <FeedbackDetail
          message={message}
          feedback={feedback}
          showTranslation={showTranslation}
          onRetryCorrectionTranslation={onRetryCorrectionTranslation}
        />
      )}
    </div>
  );
}

/** The expanded body: explanation, corrected Japanese, and grammar save. */
function FeedbackDetail({
  message,
  feedback,
  showTranslation,
  onRetryCorrectionTranslation,
}: {
  message: Message;
  feedback: Feedback;
  showTranslation: boolean;
  onRetryCorrectionTranslation: () => void;
}) {
  const showGrammarSave = feedback.labels.includes('grammar') && !!feedback.correction;

  return (
    <div className="mt-1 space-y-2 rounded-xl border border-white/10 bg-surface-1 px-3 py-2.5 text-sm">
      <p className="text-zinc-300">{feedback.explanation}</p>

      {feedback.correction && (
        <div>
          <p className="mb-0.5 text-xs uppercase tracking-wide text-zinc-500">Suggested</p>
          <p className="jp-text text-[1.02rem] text-zinc-100">{feedback.correction}</p>
          {showTranslation && (
            <TranslationText
              text={message.correctionTranslation}
              status={message.correctionTranslationStatus}
              onRetry={onRetryCorrectionTranslation}
              className="mt-0.5"
            />
          )}
        </div>
      )}

      {showGrammarSave && <GrammarSaveButton original={message.content} feedback={feedback} />}
    </div>
  );
}

/** Save a grammar correction to the personal log (brief §7). */
function GrammarSaveButton({ original, feedback }: { original: string; feedback: Feedback }) {
  const { has, save } = useSavedGrammarContext();
  const correction = feedback.correction ?? '';
  const saved = has(original, correction);

  return (
    <button
      type="button"
      onClick={() => save({ original, correction, explanation: feedback.explanation })}
      disabled={saved}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
        saved
          ? 'cursor-default border-emerald-400/30 text-emerald-400/80'
          : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {saved ? <CheckIcon className="h-3.5 w-3.5" /> : <BookmarkIcon className="h-3.5 w-3.5" />}
      {saved ? 'Saved to grammar' : 'Save grammar point'}
    </button>
  );
}

const LABEL_STYLES: Record<FeedbackLabel, string> = {
  grammar: 'bg-rose-400/15 text-rose-300',
  vocabulary: 'bg-sky-400/15 text-sky-300',
  phrasing: 'bg-violet-400/15 text-violet-300',
  naturalness: 'bg-amber-400/15 text-amber-300',
};

function LabelChip({ label }: { label: FeedbackLabel }) {
  return (
    <span className={`rounded-full px-1.5 py-px text-[0.65rem] font-medium ${LABEL_STYLES[label]}`}>
      {label}
    </span>
  );
}
