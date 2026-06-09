import { useState } from 'react';

import { MessageInput } from './components/chat/MessageInput';
import { MessageList } from './components/chat/MessageList';
import { Header } from './components/layout/Header';
import { ReadingControls } from './components/reading/ReadingControls';
import { SavedPanel } from './components/reading/SavedPanel';
import { SettingsBar } from './components/settings/SettingsBar';
import { ErrorBanner } from './components/ui/ErrorBanner';
import { DEFAULT_SETTINGS } from './config/settings';
import { SavedGrammarContext } from './context/SavedGrammarContext';
import { SavedVocabContext } from './context/SavedVocabContext';
import { useConversation } from './hooks/useConversation';
import { useSavedGrammar } from './hooks/useSavedGrammar';
import { useSavedVocab } from './hooks/useSavedVocab';
import type { ConversationSettings } from './types/conversation';

export default function App() {
  const [settings, setSettings] = useState<ConversationSettings>(DEFAULT_SETTINGS);
  // Reading aids are opt-in and off by default (brief §6) — clean Japanese first.
  const [showFurigana, setShowFurigana] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  const { messages, status, error, send, stop, reset, requestTranslation, retryFeedback } =
    useConversation();
  const savedVocab = useSavedVocab();
  const savedGrammar = useSavedGrammar();

  return (
    <SavedVocabContext.Provider value={savedVocab}>
      <SavedGrammarContext.Provider value={savedGrammar}>
        <div className="flex h-dvh flex-col bg-surface-0">
          <Header onReset={reset} canReset={messages.length > 0} />

          <div className="border-b border-white/10 bg-surface-1 px-4 py-2">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2">
              <SettingsBar settings={settings} onChange={setSettings} />
              <ReadingControls
                showFurigana={showFurigana}
                onToggleFurigana={() => setShowFurigana((v) => !v)}
                showTranslation={showTranslation}
                onToggleTranslation={() => setShowTranslation((v) => !v)}
                onOpenSaved={() => setSavedOpen(true)}
              />
            </div>
          </div>

          <main className="flex-1 overflow-y-auto">
            <MessageList
              messages={messages}
              showFurigana={showFurigana}
              showTranslation={showTranslation}
              onRequestTranslation={requestTranslation}
              onRetryFeedback={(id) => retryFeedback(id, settings)}
            />
          </main>

          {error && <ErrorBanner message={error} />}

          <MessageInput status={status} onSend={(text) => send(text, settings)} onStop={stop} />

          <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
        </div>
      </SavedGrammarContext.Provider>
    </SavedVocabContext.Provider>
  );
}
