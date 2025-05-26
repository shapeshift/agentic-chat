import React, { useMemo } from 'react';
import { EXAMPLE_PROMPTS } from '../lib/constants/prompts';
import { PromptTemplate } from '@langchain/core/prompts';

interface ExamplePromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

export const ExamplePrompts: React.FC<ExamplePromptsProps> = ({
  onSelectPrompt,
}) => (
  <div className="flex flex-row gap-3 w-full">
    {EXAMPLE_PROMPTS.map((example, idx) => {
      // Interpolate the template with sampleVariables for display
      const promptTemplate = useMemo(
        () => PromptTemplate.fromTemplate(example.template),
        [example.template]
      );
      const [display, setDisplay] = React.useState(example.template);
      React.useEffect(() => {
        promptTemplate.format(example.sampleVariables).then(setDisplay);
      }, [promptTemplate, example.sampleVariables]);
      return (
        <button
          key={idx}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 whitespace-nowrap"
          onClick={() => onSelectPrompt(display)}
          type="button"
        >
          <span className="text-sm text-zinc-200">{display}</span>
        </button>
      );
    })}
  </div>
);
