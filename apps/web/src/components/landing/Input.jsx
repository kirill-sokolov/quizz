import { cn } from '../../lib/utils';

export function Input(props) {
  return <input {...props} className={cn('h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm', props.className)} />;
}

export function Textarea(props) {
  return <textarea {...props} className={cn('min-h-24 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm', props.className)} />;
}
