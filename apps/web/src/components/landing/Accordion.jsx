import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

export function FAQAccordion({ items }) {
  return (
    <Accordion.Root type="single" collapsible className="space-y-3">
      {items.map((item, index) => (
        <Accordion.Item key={item} value={`i-${index}`} className="rounded-xl border border-zinc-800 px-4">
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between py-4 text-left font-medium">
              {item}
              <ChevronDown size={18} />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-4 text-sm text-zinc-300">Обсуждаем на созвоне и подстраиваем под вашу аудиторию.</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
