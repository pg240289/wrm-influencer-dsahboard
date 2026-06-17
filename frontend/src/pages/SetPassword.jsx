import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [inviteData, setInviteData] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.')
      setLoading(false)
      return
    }
    let active = true
    axios
      .get(`/auth/verify-invite?token=${token}`)
      .then((res) => {
        if (!active) return
        if (res.data.valid) {
          setInviteData(res.data)
          setTokenValid(true)
        } else {
          setError(res.data.error || 'Invalid invitation link.')
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Invalid or expired invitation link.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await axios.post('/auth/set-password', { token, password })
      if (res.data.token) {
        setSuccess('Password set successfully! Redirecting…')
        localStorage.setItem('token', res.data.token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
        const roles = res.data.user?.roles || []
        const target = roles.includes('Influencer') ? '/influencer/dashboard' : '/'
        setTimeout(() => {
          window.location.href = target
        }, 1200)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. Please try again.')
      setSubmitting(false)
    }
  }

  // Loading state — verifying the invite token
  if (loading) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Verifying your invitation</h1>
            <p className="text-sm text-muted-foreground">Just a moment…</p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // Invalid / expired token
  if (!tokenValid) {
    return (
      <AuthLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invitation link issue</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">We couldn't verify this invitation.</p>
        </div>
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button className="w-full" onClick={() => (window.location.href = '/login')}>
          Go to login
        </Button>
      </AuthLayout>
    )
  }

  // Valid token — set password form
  return (
    <AuthLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome{inviteData?.name ? `, ${inviteData.name}` : ''}!
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Set a password to activate your account.</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-5">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={inviteData?.email || ''} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            autoFocus
            required
          />
          <PasswordStrength value={password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting || !!success}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Setting password…' : 'Set password & continue'}
        </Button>
      </form>
    </AuthLayout>
  )
}
