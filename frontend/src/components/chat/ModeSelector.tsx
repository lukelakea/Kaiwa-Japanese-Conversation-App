/**
 * Mode selection flow shown before a conversation starts (brief §5).
 *
 * Manages three internal steps:
 *   mode-picker     → choose Free Talk / Scenarios / Generated / Design Your Own
 *   scenario-list   → browse curated scenarios
 *   scenario-detail → confirm a selected scenario and start it
 *   generated-setup → enter an optional theme and generate
 *   generated-detail→ preview the generated scenario and start it
 *   custom-setup    → describe your own scenario and start it
 */

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

const ALLOW_CUSTOM_SCENARIOS = import.meta.env.VITE_ALLOW_CUSTOM_SCENARIOS !== 'false';

import { fadeRise, fadeSlide, listStagger, transitions } from '../../config/motion';
import { generateScenario } from '../../api/client';
import { CURATED_SCENARIOS, toWireScenario, type CuratedScenario } from '../../config/scenarios';
import { DIFFICULTY_OPTIONS, FORMALITY_OPTIONS, INITIATIVE_OPTIONS } from '../../config/settings';
import { SettingDropdown } from '../settings/SettingDropdown';
import { TrashIcon } from '../ui/icons';
import type { ConversationMode, ConversationSettings, Scenario } from '../../types/conversation';
import type { SavedScenario } from '../../types/scenario';

type Step =
  | { name: 'mode-picker' }
  | { name: 'scenario-list' }
  | { name: 'scenario-detail'; curated: CuratedScenario }
  | { name: 'generated-setup' }
  | { name: 'generated-loading' }
  | { name: 'generated-detail'; scenario: Scenario }
  | { name: 'custom-setup' };

interface ModeSelectorProps {
  settings: ConversationSettings;
  savedScenarios: SavedScenario[];
  onSaveScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
  onStartFreeTalk: () => void;
  onStartScenario: (
    scenario: Scenario,
    mode: ConversationMode,
    settings?: ConversationSettings,
  ) => void;
}

export function ModeSelector({
  settings,
  savedScenarios,
  onSaveScenario,
  onDeleteScenario,
  onStartFreeTalk,
  onStartScenario,
}: ModeSelectorProps) {
  const [step, setStep] = useState<Step>({ name: 'mode-picker' });
  const [theme, setTheme] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [customTitle, setCustomTitle] = useState('');
  const [customUserRole, setCustomUserRole] = useState('');
  const [customAiRole, setCustomAiRole] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [customSettings, setCustomSettings] = useState<ConversationSettings>(settings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

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

  const buildCustomScenario = (): Scenario | null => {
    const userRole = customUserRole.trim();
    const aiRole = customAiRole.trim();
    const description = customDescription.trim();
    if (!userRole || !aiRole || !description) {
      setCustomError('Please fill in your role, their role, and the setting.');
      return null;
    }
    setCustomError(null);
    const title = customTitle.trim() || `A conversation with ${aiRole}`;
    return {
      title,
      title_ja: title,
      description,
      user_role: userRole,
      ai_role: aiRole,
      notes: customNotes.trim() || undefined,
      goal: customGoal.trim() || undefined,
    };
  };

  const handleStartCustom = () => {
    const scenario = buildCustomScenario();
    if (!scenario) return;
    onStartScenario(scenario, 'scenario', customSettings);
  };

  const handleSaveCustom = () => {
    const scenario = buildCustomScenario();
    if (!scenario) return;
    const id = editingId ?? `scenario-${Date.now()}`;
    onSaveScenario({ ...scenario, id, settings: customSettings, savedAt: new Date().toISOString() });
    setEditingId(id);
  };

  const loadSavedScenario = (saved: SavedScenario) => {
    setCustomTitle(saved.title);
    setCustomUserRole(saved.user_role);
    setCustomAiRole(saved.ai_role);
    setCustomDescription(saved.description);
    setCustomNotes(saved.notes ?? '');
    setCustomGoal(saved.goal ?? '');
    setCustomSettings(saved.settings);
    setEditingId(saved.id);
    setCustomError(null);
  };

  const handleNewCustom = () => {
    setCustomTitle('');
    setCustomUserRole('');
    setCustomAiRole('');
    setCustomDescription('');
    setCustomNotes('');
    setCustomGoal('');
    setCustomSettings(settings);
    setEditingId(null);
    setCustomError(null);
  };

  const handleDeleteSaved = (id: string) => {
    onDeleteScenario(id);
    if (editingId === id) handleNewCustom();
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
            <p className="mt-2 text-sm text-zinc-500">Choose how you want to practice today.</p>
          </div>

          <motion.div
            variants={listStagger}
            initial="hidden"
            animate="visible"
            className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
              description="Pick a real-life situation and practice in context."
              onClick={() => setStep({ name: 'scenario-list' })}
            />
            <ModeCard
              label="Generated"
              labelJa="生成シナリオ"
              description="The AI creates a fresh scenario, optionally on a theme."
              onClick={() => setStep({ name: 'generated-setup' })}
            />
            {ALLOW_CUSTOM_SCENARIOS && (
              <ModeCard
                label="Design Your Own"
                labelJa="シナリオを作る"
                description="Set the roles, setting, and any notes for the AI to follow."
                onClick={() => setStep({ name: 'custom-setup' })}
              />
            )}
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

    if (step.name === 'custom-setup') {
      return (
        <div className="mx-auto flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto px-6 py-8">
          <BackButton onClick={() => setStep({ name: 'mode-picker' })} />
          <div>
            <h2 className="mb-1 text-lg font-semibold text-zinc-200">Design a Scenario</h2>
            <p className="text-sm text-zinc-500">
              Set up who you are, who they are, and the situation. Add any extra notes the AI
              should keep in mind.
            </p>
          </div>

          {savedScenarios.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-zinc-400">Saved scenarios</span>
              <div className="flex flex-col gap-1.5">
                {savedScenarios.map((saved) => (
                  <SavedScenarioRow
                    key={saved.id}
                    scenario={saved}
                    isActive={saved.id === editingId}
                    onLoad={() => loadSavedScenario(saved)}
                    onDelete={() => handleDeleteSaved(saved.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <FormField
            label="Your role — who/what you are"
            placeholder="e.g. A tourist who just landed in Tokyo"
            value={customUserRole}
            onChange={setCustomUserRole}
          />
          <FormField
            label="Their role — who/what they are"
            placeholder="e.g. A friendly station attendant"
            value={customAiRole}
            onChange={setCustomAiRole}
          />
          <FormTextArea
            label="Setting"
            placeholder="Describe where this takes place and what's going on"
            value={customDescription}
            onChange={setCustomDescription}
          />
          <FormField
            label="Your goal (optional)"
            placeholder="e.g. Convince them to give you a refund"
            value={customGoal}
            onChange={setCustomGoal}
          />
          <FormTextArea
            label="Additional instructions (optional)"
            placeholder="Anything else to keep in mind for this conversation, e.g. names, constraints, things to avoid"
            value={customNotes}
            onChange={setCustomNotes}
          />
          <FormField
            label="Title (optional)"
            placeholder="e.g. Lost at Shinjuku Station"
            value={customTitle}
            onChange={setCustomTitle}
          />

          <div>
            <span className="mb-1.5 block text-sm text-zinc-400">Conversation settings</span>
            <div className="flex flex-wrap gap-2">
              <SettingDropdown
                title="Difficulty"
                value={customSettings.difficulty}
                options={DIFFICULTY_OPTIONS}
                onChange={(difficulty) => setCustomSettings((s) => ({ ...s, difficulty }))}
              />
              <SettingDropdown
                title="Register"
                value={customSettings.formality}
                options={FORMALITY_OPTIONS}
                onChange={(formality) => setCustomSettings((s) => ({ ...s, formality }))}
              />
              <SettingDropdown
                title="Initiative"
                value={customSettings.initiative}
                options={INITIATIVE_OPTIONS}
                onChange={(initiative) => setCustomSettings((s) => ({ ...s, initiative }))}
              />
            </div>
          </div>

          {customError && <p className="text-sm text-red-400">{customError}</p>}

          <div className="flex items-center justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={handleNewCustom}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              >
                New scenario
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveCustom}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleStartCustom}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              Start Conversation
            </button>
          </div>
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

function SavedScenarioRow({
  scenario,
  isActive,
  onLoad,
  onDelete,
}: {
  scenario: SavedScenario;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onLoad}
      onKeyDown={(e) => e.key === 'Enter' && onLoad()}
      className={`group flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-accent-500/50 hover:bg-surface-2 ${
        isActive ? 'border-accent-500/50 bg-surface-2' : 'border-border bg-surface-1'
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{scenario.title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete "${scenario.title}"`}
        className="shrink-0 rounded-md p-1 text-zinc-600 opacity-0 transition-all hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-zinc-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-accent-500 focus:outline-none"
      />
    </label>
  );
}

function FormTextArea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-zinc-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-accent-500 focus:outline-none"
      />
    </label>
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
