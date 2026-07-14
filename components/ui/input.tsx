'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-text-muted)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-12 w-full rounded-[var(--radius-md)] px-4 text-sm',
            'bg-[var(--color-surface-3)] border border-[var(--color-border)]',
            'text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]',
            'transition-all duration-200',
            'focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20',
            'focus:bg-[var(--color-surface-4)]',
            error && 'border-[var(--color-danger)]/70 focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20',
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-[var(--color-text-dim)] pl-1">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-[var(--color-danger)] pl-1">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
