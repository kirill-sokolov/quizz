import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-zinc-950 hover:bg-brand-500',
        secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
        outline: 'border border-zinc-700 bg-transparent hover:bg-zinc-800'
      },
      size: {
        default: 'h-11 px-5',
        lg: 'h-12 px-6'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
