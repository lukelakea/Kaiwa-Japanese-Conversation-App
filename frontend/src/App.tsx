import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MessageInput } from './components/chat/MessageInput';
import { MessageList } from './components/chat/MessageList';
import { ModeSelector } from './components/chat/ModeSelector';
import { ConversationHistory } from './components/history/ConversationHistory';
import { Header } from './components/layout/Header';
import { ReadingControls } from './components/reading/ReadingControls';
import { SavedPanel } from './components/reading/SavedPanel';
import { AppSettingsPanel } from './components/settings/AppSettingsPanel';
import { ErrorBanner } from './components/ui/ErrorBanner';
import { HistoryIcon } from './components/ui/icons';
import { Tooltip } from './components/ui/Tooltip';
import { DEFAULT_SETTINGS } from './config/settings';
import { SavedGrammarContext } from './context/SavedGrammarContext';
import { SavedVocabContext } from './context/SavedVocabContext';
import { useAppSettings } from './hooks/useAppSettings';
import { useConversation } from './hooks/useConversation';
import { useSavedConversations } from './hooks/useSavedConversations';
import { useSavedGrammar } from './hooks/useSavedGrammar';
import { useSavedScenarios } from './hooks/useSavedScenarios';
import { useSavedVocab } from './hooks/useSavedVocab';
import type { ConversationMode, ConversationSettings, Scenario } from './types/conversation';
import type { SavedConversation } from './types/history';

function deriveTitle(
  messages: { role: string; content: string }[],
  scenario: Scenario | null,
): string {
  if (scenario) return scenario.title;
  const first = messages.find((m) => m.role === 'user');
  if (first) {
    const text = first.content.trim();
    return text.length > 52 ? text.slice(0, 49) + '…' : text;
  }
  return 'Free talk';
}

export default function App() {
  const [settings, setSettings] = useState<ConversationSettings>(DEFAULT_SETTINGS);
  const [showFurigana, setShowFurigana] = useState(false);
  const [showRomaji, setShowRomaji] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { settings: appSettings, update: updateAppSettings } = useAppSettings();

  // null = mode picker is shown; set once the user starts a conversation.
  const [activeMode, setActiveMode] = useState<ConversationMode | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  // Stable id for the current conversation, used to upsert into history.
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationStartedAt = useRef<string | null>(null);

  // Text restored to the input when the user rewinds their last message to
  // edit it. `key` increments on each rewind so the same text can be
  // reapplied even if it's identical to what's already in the input.
  const [draft, setDraft] = useState<{ key: number; text: string }>({ key: 0, text: '' });

  const {
    messages,
    status,
    error,
    send,
    startScenario,
    rewindToMessage,
    regenerateReply,
    stop,
    reset,
    restore,
    requestTranslation,
    requestCorrectionTranslation,
    retryFeedback,
  } = useConversation();
  const savedVocab = useSavedVocab();
  const savedGrammar = useSavedGrammar();
  const { conversations, save: saveConversation, remove: removeConversation } =
    useSavedConversations();
  const {
    scenarios: savedScenarios,
    save: saveScenario,
    remove: removeScenario,
  } = useSavedScenarios();

  // Auto-save after each complete exchange (skip during streaming to avoid
  // hundreds of partial writes; translation/feedback patches fire afterwards).
  useEffect(() => {
    if (!conversationId || !activeMode || messages.length === 0 || status === 'streaming') return;
    const conversation: SavedConversation = {
      id: conversationId,
      title: deriveTitle(messages, activeScenario),
      messages,
      settings,
      mode: activeMode,
      scenario: activeScenario,
      createdAt: conversationStartedAt.current ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveConversation(conversation);
  }, [messages, conversationId, activeMode, activeScenario, settings, saveConversation, status]);

  const handleReset = useCallback(() => {
    reset();
    setActiveMode(null);
    setActiveScenario(null);
    setConversationId(null);
    conversationStartedAt.current = null;
  }, [reset]);

  const handleStartFreeTalk = useCallback(() => {
    const id = `conv-${Date.now()}`;
    setConversationId(id);
    conversationStartedAt.current = new Date().toISOString();
    setActiveMode('free_talk');
    setActiveScenario(null);
  }, []);

  const handleStartScenario = useCallback(
    async (scenario: Scenario, mode: ConversationMode, scenarioSettings?: ConversationSettings) => {
      const id = `conv-${Date.now()}`;
      setConversationId(id);
      conversationStartedAt.current = new Date().toISOString();
      setActiveMode(mode);
      setActiveScenario(scenario);
      const effectiveSettings = scenarioSettings ?? settings;
      if (scenarioSettings) setSettings(scenarioSettings);
      await startScenario(scenario, effectiveSettings, mode);
    },
    [settings, startScenario],
  );

  const handleRewind = useCallback(
    (id: string) => {
      const text = rewindToMessage(id);
      if (text === null) return;
      setDraft((prev) => ({ key: prev.key + 1, text }));
    },
    [rewindToMessage],
  );

  const handleRegenerate = useCallback(
    (id: string) => {
      if (!activeMode) return;
      void regenerateReply(id, settings, activeMode, activeScenario ?? undefined);
    },
    [regenerateReply, settings, activeMode, activeScenario],
  );

  const handleRestoreConversation = useCallback(
    (conversation: SavedConversation) => {
      restore(conversation.messages);
      setSettings(conversation.settings);
      setActiveMode(conversation.mode);
      setActiveScenario(conversation.scenario);
      setConversationId(conversation.id);
      conversationStartedAt.current = conversation.createdAt;
    },
    [restore],
  );

  const conversationActive = activeMode !== null;

  return (
    <SavedVocabContext.Provider value={savedVocab}>
      <SavedGrammarContext.Provider value={savedGrammar}>
        <div className="flex h-dvh flex-col bg-surface-0">
          <Header
            onReset={handleReset}
            scenarioTitle={activeScenario?.title_ja}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenSaved={() => setSavedOpen(true)}
            savedCount={savedVocab.words.length + savedGrammar.items.length}
            ttsAutoPlay={appSettings.ttsAutoPlay}
            onToggleAutoPlay={() => updateAppSettings({ ttsAutoPlay: !appSettings.ttsAutoPlay })}
            settings={settings}
            onSettingsChange={setSettings}
            conversationActive={conversationActive}
          />

          <div className="border-b border-border bg-surface-1 px-4 pb-2 pt-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
              {/* Left */}
              <div className="flex min-w-0 items-center gap-2">
                <Tooltip label="History">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    aria-label="Conversation history"
                    className="shrink-0 rounded-lg border border-border p-1.5 text-zinc-400 transition-colors hover:border-border-strong hover:text-zinc-100"
                  >
                    <HistoryIcon className="h-4 w-4" />
                  </button>
                </Tooltip>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!conversationActive}
                  className="shrink-0 whitespace-nowrap rounded-lg border border-accent-700/50 bg-accent-700/10 px-3 py-1.5 text-sm text-accent-300 transition-colors hover:border-accent-600/60 hover:bg-accent-700/20 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  New conversation
                </button>
              </div>

              {/* Center — always rendered for consistent row height */}
              <div
                className={`flex items-center justify-center gap-2 ${!conversationActive ? 'invisible pointer-events-none' : ''}`}
                aria-hidden={!conversationActive}
              >
                <ReadingControls
                  showFurigana={showFurigana}
                  onToggleFurigana={() => setShowFurigana((v) => !v)}
                  showRomaji={showRomaji}
                  onToggleRomaji={() => setShowRomaji((v) => !v)}
                  showTranslation={showTranslation}
                  onToggleTranslation={() => setShowTranslation((v) => !v)}
                />
              </div>

              {/* Right — empty spacer to balance the left column */}
              <div />
            </div>
          </div>

          {conversationActive ? (
            <main className="flex-1 overflow-y-auto">
              <MessageList
                messages={messages}
                showFurigana={showFurigana}
                showRomaji={showRomaji}
                showTranslation={showTranslation}
                textSize={appSettings.textSize}
                ttsVoice={appSettings.ttsVoice}
                ttsSpeed={appSettings.ttsSpeed}
                ttsAutoPlay={appSettings.ttsAutoPlay}
                canRewind={status !== 'streaming'}
                onRequestTranslation={requestTranslation}
                onRequestCorrectionTranslation={requestCorrectionTranslation}
                onRetryFeedback={(id) => retryFeedback(id, settings)}
                onRewind={handleRewind}
                onRegenerate={handleRegenerate}
              />
            </main>
          ) : (
            <main className="flex-1 overflow-y-auto">
              <ModeSelector
                settings={settings}
                savedScenarios={savedScenarios}
                onSaveScenario={saveScenario}
                onDeleteScenario={removeScenario}
                onStartFreeTalk={handleStartFreeTalk}
                onStartScenario={(scenario, mode, scenarioSettings) =>
                  void handleStartScenario(scenario, mode, scenarioSettings)
                }
              />
            </main>
          )}

          <AnimatePresence>{error && <ErrorBanner key="error" message={error} />}</AnimatePresence>

          {conversationActive && (
            <MessageInput
              status={status}
              onSend={(text) =>
                void send(text, settings, activeMode ?? 'free_talk', activeScenario ?? undefined)
              }
              onStop={stop}
              draftText={draft.text}
              draftKey={draft.key}
              showTranslationPreview={appSettings.inputTranslation}
            />
          )}

          <SavedPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
          <AppSettingsPanel
            open={settingsOpen}
            settings={appSettings}
            onChange={updateAppSettings}
            onClose={() => setSettingsOpen(false)}
          />
          <ConversationHistory
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            conversations={conversations}
            onRestore={handleRestoreConversation}
            onDelete={removeConversation}
            activeId={conversationId}
          />
        </div>
      </SavedGrammarContext.Provider>
    </SavedVocabContext.Provider>
  );
}
