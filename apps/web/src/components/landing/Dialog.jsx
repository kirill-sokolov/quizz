import * as Dialog from '@radix-ui/react-dialog';

export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogPortal = Dialog.Portal;
export const DialogClose = Dialog.Close;

export function DialogContent({ children }) {
  return (
    <DialogPortal>
      <Dialog.Overlay className="fixed inset-0 bg-black/70" />
      <Dialog.Content className="fixed left-1/2 top-1/2 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-700 bg-zinc-950 p-6">
        {children}
      </Dialog.Content>
    </DialogPortal>
  );
}
