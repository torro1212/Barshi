'use client'

import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-semibold',
    'transition-all duration-200 cursor-pointer select-none',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    'active:scale-[0.96]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-brand)] text-white',
          'hover:bg-[var(--color-brand-light)]',
          'shadow-[0_0_20px_rgba(139,92,246,0.4)]',
          'hover:shadow-[0_0_32px_rgba(139,92,246,0.6)]',
        ].join(' '),
        secondary: [
          'bg-[var(--color-surface-3)] text-[var(--color-text)]',
          'border border-[var(--color-border)]',
          'hover:border-[var(--color-border-light)] hover:bg-[var(--color-surface-4)]',
        ].join(' '),
        ghost: [
          'text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]',
        ].join(' '),
        danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 shadow-[0_0_16px_rgba(239,68,68,0.35)]',
        success: 'bg-[var(--color-success)] text-white hover:opacity-90 shadow-[0_0_16px_rgba(34,197,94,0.35)]',
        outline: [
          'border border-[var(--color-brand)]/50 text-[var(--color-brand-light)]',
          'hover:bg-[var(--color-brand)]/10 hover:border-[var(--color-brand)]',
        ].join(' '),
      },
      size: {
        sm:   'h-9  px-3.5 text-sm  rounded-[var(--radius-md)]',
        md:   'h-11 px-5   text-sm  rounded-[var(--radius-md)]',
        lg:   'h-13 px-7   text-base rounded-[var(--radius-lg)]',
        xl:   'h-16 px-10  text-lg  rounded-[var(--radius-xl)]',
        icon: 'h-10 w-10  p-0      rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, asChild = false, children, disabled, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading && (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
