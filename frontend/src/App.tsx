import { useCallback, useState } from 'react';

import { MessageInput } from './components/chat/MessageInput';
import { MessageList } from './components/chat/MessageList';
import { ModeSelector } from './components/chat/ModeSelector';
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
import type { ConversationMode, ConversationSettings, Scenario } from './types/conversation';

export default function App() {
  const [settings, setSettings] = useState<ConversationSettings>(DEFAULT_SETTINGS);
  const [showFurigana, setShowFurigana] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  // null = mode picker is shown; set once the user starts a conversation.
  const [activeMode, setActiveMode] = useState<ConversationMode | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  const {
    messages,
    status,
    error,
    send,
    startScenario,
    stop,
    reset,
    requestTranslation,
    retryFeedback,
  } = useConversation();
  const savedVocab = useSavedVocab();
  const savedGrammar = useSavedGrammar();

  const handleReset = useCallback(() => {
    reset();
    setActiveMode(null);
    setActiveScenario(null);
  }, [reset]);

  const handleStartFreeTalk = useCallback(() => {
    setActiveMode('free_talk');
    setActiveScenario(null);
  }, []);

  const handleStartScenario = useCallback(
    async (scenario: Scenario, mode: ConversationMode) => {
      setActiveMode(mode);
      setActiveScenario(scenario);
      await startScenario(scenario, settings, mode);
    },
    [settings, startScenario],
  );

  const conversationActive = activeMode !== null;

  return (
    <SavedVocabContext.Provider value={savedVocab}>
      <SavedGrammarContext.Provider value={savedGrammar}>
        <div className="flex h-dvh flex-col bg-surface-0">
          <Header
            onReset={handleReset}
            canReset={conversationActive}
            scenarioTitle={activeScenario?.title_ja}
          />

          {conversationActive && (
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
          )}

          {conversationActive ? (
            <main className="flex-1 overflow-y-auto">
              <MessageList
                messages={messages}
                showFurigana={showFurigana}
                showTranslation={showTranslation}
                onRequestTranslation={requestTranslation}
                onRetryFeedback={(id) => retryFeedback(id, settings)}
              />
            </main>
          ) : (
            <main className="flex-1 overflow-y-auto">
              <ModeSelector
                settings={settings}
                onStartFreeTalk={handleStartFreeTalk}
                onStartScenario={(scenario, mode) => void handleStartScenario(scenario, mode)}
              />
            </main>
          )}

          {error && <ErrorBanner message={error} />}

          {conversationActive && (
            <MessageInput
              status={status}
              onSend={(text) =>
                void send(text, settings, activeMode ?? 'free_talk', activeScenario ?? undefined)
              }
              onStop={stop}
            />
          )}

          <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
        </div>
      </SavedGrammarContext.Provider>
    </SavedVocabContext.Provider>
  );
}
