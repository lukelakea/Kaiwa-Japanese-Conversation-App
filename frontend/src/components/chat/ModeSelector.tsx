/**
 * Mode selection flow shown before a conversation starts (brief §5).
 *
 * Manages three internal steps:
 *   mode-picker     → choose Free Talk / Scenarios / Generated
 *   scenario-list   → browse curated scenarios
 *   scenario-detail → confirm a selected scenario and start it
 *   generated-setup → enter an optional theme and generate
 *   generated-detail→ preview the generated scenario and start it
 */

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import { fadeRise, fadeSlide, listStagger, transitions } from '../../config/motion';
import { generateScenario } from '../../api/client';
import { CURATED_SCENARIOS, toWireScenario, type CuratedScenario } from '../../config/scenarios';
import type { ConversationMode, ConversationSettings, Scenario } from '../../types/conversation';

type Step =
  | { name: 'mode-picker' }
  | { name: 'scenario-list' }
  | { name: 'scenario-detail'; curated: CuratedScenario }
  | { name: 'generated-setup' }
  | { name: 'generated-loading' }
  | { name: 'generated-detail'; scenario: Scenario };

interface ModeSelectorProps {
  settings: ConversationSettings;
  onStartFreeTalk: () => void;
  onStartScenario: (scenario: Scenario, mode: ConversationMode) => void;
}

export function ModeSelector({ settings, onStartFreeTalk, onStartScenario }: ModeSelectorProps) {
  const [step, setStep] = useState<Step>({ name: 'mode-picker' });
  const [theme, setTheme] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerateError(null);
    setStep({ name: 'generated-loading' });
    try {
      const scenario = await generateScenario(theme.trim() || null, settings);
      setStep({ name: 'generated-detail', scenario });
    } catch {
      setGenerateError('Could not generate a scenario. Please try again.');
      setStep({ name: 'generated-setup' });
    }
  };

  // Each step's content; wrapped below in an AnimatePresence so switching steps
  // cross-fades rather than snapping.
  const content = renderStep();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.name}
        variants={fadeSlide}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="h-full"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );

  function renderStep() {
    if (step.name === 'mode-picker') {
      return (
        <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-8 px-6">
          <div className="text-center">
            <p className="jp-text display-heading text-3xl text-zinc-200">会話を始めましょう</p>
            <p className="mt-2 text-sm text-zinc-500">Choose how you want to practise today.</p>
          </div>

          <motion.div
            variants={listStagger}
            initial="hidden"
            animate="visible"
            className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <ModeCard
              label="Free Talk"
              labelJa="フリートーク"
              description="Open-ended conversation — chat about anything."
              onClick={onStartFreeTalk}
            />
            <ModeCard
              label="Scenarios"
              labelJa="シナリオ"
              description="Pick a real-life situation and practise in context."
              onClick={() => setStep({ name: 'scenario-list' })}
            />
            <ModeCard
              label="Generated"
              labelJa="生成シナリオ"
              description="The AI creates a fresh scenario, optionally on a theme."
              onClick={() => setStep({ name: 'generated-setup' })}
            />
          </motion.div>
        </div>
      );
    }

    if (step.name === 'scenario-list') {
      return (
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto px-6 py-8">
          <BackButton onClick={() => setStep({ name: 'mode-picker' })} />
          <h2 className="text-lg font-semibold text-zinc-200">Choose a Scenario</h2>
          <motion.div
            variants={listStagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {CURATED_SCENARIOS.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                onClick={() => setStep({ name: 'scenario-detail', curated: s })}
              />
            ))}
          </motion.div>
        </div>
      );
    }

    if (step.name === 'scenario-detail') {
      const { curated } = step;
      return (
        <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-6 px-6">
          <BackButton onClick={() => setStep({ name: 'scenario-list' })} />
          <ScenarioDetail
            title={curated.title}
            titleJa={curated.titleJa}
            description={curated.description}
            userRole={curated.userRole}
            aiRole={curated.aiRole}
            onStart={() => onStartScenario(toWireScenario(curated), 'scenario')}
          />
        </div>
      );
    }

    if (step.name === 'generated-setup') {
      return (
        <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 px-6">
          <BackButton onClick={() => setStep({ name: 'mode-picker' })} />
          <div className="w-full">
            <h2 className="mb-1 text-lg font-semibold text-zinc-200">Generate a Scenario</h2>
            <p className="mb-5 text-sm text-zinc-500">
              Leave blank for a surprise, or enter a theme to guide the AI.
            </p>

            <label className="mb-1.5 block text-sm text-zinc-400" htmlFor="theme-input">
              Theme (optional)
            </label>
            <input
              id="theme-input"
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void handleGenerate();
              }}
              placeholder="e.g. bakery, train station, job fair…"
              className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-accent-500 focus:outline-none"
            />

            {generateError && <p className="mt-2 text-sm text-red-400">{generateError}</p>}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
              >
                Generate Scenario
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (step.name === 'generated-loading') {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="animate-pulse text-sm text-zinc-500">Generating scenario…</p>
        </div>
      );
    }

    // generated-detail
    const { scenario } = step;
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-6 px-6">
        <BackButton onClick={() => setStep({ name: 'generated-setup' })} />
        <ScenarioDetail
          title={scenario.title}
          titleJa={scenario.title_ja}
          description={scenario.description}
          userRole={scenario.user_role}
          aiRole={scenario.ai_role}
          onStart={() => onStartScenario(scenario, 'generated')}
        />
      </div>
    );
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ModeCard({
  label,
  labelJa,
  description,
  onClick,
}: {
  label: string;
  labelJa: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={fadeRise}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={transitions.spring}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-5 text-left transition-colors hover:border-accent-500/50 hover:bg-surface-2 hover:shadow-md"
    >
      <div>
        <p className="font-medium text-zinc-100">{label}</p>
        <p className="jp-text text-sm text-zinc-500">{labelJa}</p>
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
    </motion.button>
  );
}

function ScenarioCard({ scenario, onClick }: { scenario: CuratedScenario; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={fadeRise}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={transitions.spring}
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-1 p-4 text-left transition-colors hover:border-accent-500/50 hover:bg-surface-2 hover:shadow-md"
    >
      <p className="jp-text text-base font-medium text-zinc-100">{scenario.titleJa}</p>
      <p className="text-sm text-zinc-400">{scenario.title}</p>
      <p className="text-xs text-zinc-600">{scenario.hint}</p>
    </motion.button>
  );
}

function ScenarioDetail({
  title,
  titleJa,
  description,
  userRole,
  aiRole,
  onStart,
}: {
  title: string;
  titleJa: string;
  description: string;
  userRole: string;
  aiRole: string;
  onStart: () => void;
}) {
  return (
    <div className="w-full rounded-xl border border-border bg-surface-1 p-6 shadow-md">
      <p className="jp-text text-2xl font-semibold text-zinc-100">{titleJa}</p>
      <p className="mt-0.5 text-sm text-zinc-400">{title}</p>

      <p className="mt-4 text-sm leading-relaxed text-zinc-300">{description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <RoleChip label="Your role" value={userRole} />
        <RoleChip label="Partner" value={aiRole} />
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-lg bg-accent-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-600"
      >
        Start Scenario
      </button>
    </div>
  );
}

function RoleChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-0 px-3 py-2">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-300">{value}</p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onClick}
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        ← Back
      </button>
    </div>
  );
}
