"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal — molecules/modal
 * Radix Dialog wrapped in the Rostr paper-aesthetic shell.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "max-w-[420px]",
    md: "max-w-[560px]",
    lg: "max-w-[720px]",
  }[size];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/55 backdrop-blur-[3px] z-[100] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]",
            "w-[92vw] max-h-[90vh] overflow-hidden flex flex-col",
            "bg-paper rounded-[16px] shadow-modal",
            sizeClass,
          )}
        >
          <div className="px-[22px] py-[18px] bg-card border-b border-hair flex items-start gap-3">
            <div className="flex-1">
              <Dialog.Title className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-[12.5px] text-ink-3 leading-relaxed">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="p-1.5 rounded-sm text-ink-3 hover:text-ink hover:bg-paper transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-auto px-[22px] py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-[22px] -mb-5 mt-6 px-[22px] py-3.5 bg-card border-t border-hair flex items-center justify-end gap-2">
      {children}
    </div>
  );
}
