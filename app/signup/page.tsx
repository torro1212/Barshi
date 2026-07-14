'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuroraBackground } from '@/components/ui/AuroraBackground'

const schema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(20, 'Max 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, underscores'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ username, email, password }: FormValues) {
    setError(null)
    const supabase = createClient()

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('username', username)
    if ((count ?? 0) > 0) {
      setError('That username is taken. Try another one.')
      return
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('already exists')) {
        setError('This email is already signed up. Try signing in instead.')
      } else {
        setError('Something went wrong. Double-check your details and try again.')
      }
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--color-surface)' }}>
      <AuroraBackground variant="fixed" />

      <div className="relative w-full max-w-sm animate-rise">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-black gradient-text-anim tracking-tight mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              barshi
            </h1>
          </Link>
          <p className="text-[var(--color-text-dim)] text-sm inline-flex items-center gap-1.5">Create your creator account <Sparkles size={13} className="text-[var(--color-brand-light)]" /></p>
        </div>

        {/* Card */}
        <div className="glass rounded-[var(--radius-xl)] p-6 space-y-5">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Join Barshi</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Username"
              placeholder="coolcreator99"
              hint="Letters, numbers, underscores only"
              error={errors.username?.message}
              {...register('username')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              hint="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />

            {error && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-4 py-3">
                <p className="text-sm text-[var(--color-danger)]">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full gap-2" loading={isSubmitting}>
              <Sparkles size={16} />
              Start creating
            </Button>
          </form>

          <p className="text-xs text-center text-[var(--color-text-dim)] leading-relaxed">
            By signing up you agree to keep it safe and creative. 💜
          </p>

          <p className="text-center text-sm text-[var(--color-text-dim)]">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--color-brand-light)] hover:text-white font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
