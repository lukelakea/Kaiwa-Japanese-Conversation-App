import { useState } from 'react';

import { MessageInput } from './components/chat/MessageInput';
import { MessageList } from './components/chat/MessageList';
import { Header } from './components/layout/Header';
import { SettingsBar } from './components/settings/SettingsBar';
import { ErrorBanner } from './components/ui/ErrorBanner';
import { DEFAULT_SETTINGS } from './config/settings';
import { useConversation } from './hooks/useConversation';
import type { ConversationSettings } from './types/conversation';

export default function App() {
  const [settings, setSettings] = useState<ConversationSettings>(DEFAULT_SETTINGS);
  const { messages, status, error, send, stop, reset } = useConversation();

  return (
    <div className="flex h-dvh flex-col bg-surface-0">
      <Header onReset={reset} canReset={messages.length > 0} />

      <div className="border-b border-white/10 bg-surface-1 px-4 py-2">
        <div className="mx-auto w-full max-w-3xl">
          <SettingsBar settings={settings} onChange={setSettings} />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
      </main>

      {error && <ErrorBanner message={error} />}

      <MessageInput status={status} onSend={(text) => send(text, settings)} onStop={stop} />
    </div>
  );
}
