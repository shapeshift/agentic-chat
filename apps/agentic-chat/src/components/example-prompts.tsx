import { useEffect, useState } from 'react';
import { EXAMPLE_PROMPTS } from '../lib/constants/prompts';
import { PromptTemplate } from '@langchain/core/prompts';

interface ExamplePromptCardProps {
  template: string;
  sampleVariables: Record<string, string>;
  onSelectPrompt: (prompt: string) => void;
}

const ExamplePromptCard: React.FC<ExamplePromptCardProps> = ({
  template,
  sampleVariables,
  onSelectPrompt,
}) => {
  const promptTemplate = PromptTemplate.fromTemplate(template);
  const [display, setDisplay] = useState(template);

  useEffect(() => {
    promptTemplate.format(sampleVariables).then(setDisplay);
  }, [promptTemplate, sampleVariables]);

  return (
    <button
      className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 whitespace-nowrap"
      onClick={() => onSelectPrompt(display)}
      type="button"
    >
      <span className="text-sm text-zinc-200">{display}</span>
    </button>
  );
};

interface ExamplePromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

export const ExamplePrompts: React.FC<ExamplePromptsProps> = ({
  onSelectPrompt,
}) => (
  <div className="flex flex-row gap-3 w-full">
    {EXAMPLE_PROMPTS.map((example, idx) => (
      <ExamplePromptCard
        key={idx}
        template={example.template}
        sampleVariables={example.sampleVariables}
        onSelectPrompt={onSelectPrompt}
      />
    ))}
  </div>
);
