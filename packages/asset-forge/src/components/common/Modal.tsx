import React, { useEffect, useRef } from "react";

import { cn, focusManager } from "../../styles";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  className,
  size = "md",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const previousOverflow = useRef<string>("");

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw]",
  };

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      previousOverflow.current = document.body.style.overflow || "";
      const cleanup = modalRef.current
        ? focusManager.trapFocus(modalRef.current)
        : undefined;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";

      return () => {
        cleanup?.();
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = previousOverflow.current;
        focusManager.restoreFocus(previousActiveElement.current);
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={cn(
          "modal-content w-full animate-modal-appear",
          sizes[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
};

// Modal Body Component
export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

const ModalBody = React.forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, noPadding = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto", !noPadding && "p-6", className)}
      {...props}
    />
  ),
);

ModalBody.displayName = "ModalBody";

// Modal Section Component
export interface ModalSectionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

const ModalSection: React.FC<ModalSectionProps> = ({
  title,
  description,
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-text-secondary">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

// Modal Header Component
export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  onClose?: () => void;
}

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, title, onClose, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between p-6 border-b border-border-primary",
        className,
      )}
      {...props}
    >
      {title ? (
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      ) : (
        children
      )}
      {onClose && (
        <button onClick={onClose} className="icon-btn" aria-label="Close modal">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  ),
);

ModalHeader.displayName = "ModalHeader";

// Modal Footer Component
export interface ModalFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-3 p-6 border-t border-border-primary",
        className,
      )}
      {...props}
    />
  ),
);

ModalFooter.displayName = "ModalFooter";

export { Modal, ModalBody, ModalSection, ModalHeader, ModalFooter };
