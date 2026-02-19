import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn('rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5', className)} {...props} />;
}
