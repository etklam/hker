import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockLogin = vi.fn()
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

vi.mock('@/lib/toast', () => ({
  pushToast: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'auth.loginTitle') return 'Login'
      if (key === 'auth.email') return 'Email'
      if (key === 'auth.password') return 'Password'
      if (key === 'auth.submitLogin') return 'Sign In'
      if (key === 'common.signingIn') return 'Signing in...'
      if (key === 'auth.noAccount') return "Don't have an account?"
      if (key === 'auth.submitRegister') return 'Register'
      if (key === 'auth.errors.emailRequired') return 'Email is required'
      if (key === 'auth.errors.passwordRequired') return 'Password is required'
      if (key === 'auth.errors.invalidCredentials') return 'Invalid credentials'
      if (key === 'auth.errors.login') return 'Login failed'
      if (key === 'auth.loginSuccess') return 'Welcome back!'
      return key
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}))

vi.mock('next/link', () => {
  const { createElement } = require('react')
  return { default: (props: any) => createElement('a', props, props.children) }
})

describe('LoginPage', () => {
  let LoginPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(auth)/login/page')
    LoginPage = mod.default
  })

  it('renders login form', () => {
    render(<LoginPage />)
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('shows error when email is empty', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText('Sign In'))
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('shows error when password is empty', async () => {
    render(<LoginPage />)
    const emailInput = screen.getByPlaceholderText('you@example.com')
    await userEvent.type(emailInput, 'test@test.com')
    await userEvent.click(screen.getByText('Sign In'))
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('calls login on valid submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'test@test.com')
    // Password input has type=password, so useLabelText or querySelector
    const passwordInput = screen.getByLabelText('Password')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(screen.getByText('Sign In'))
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' })
    })
  })

  it('shows register link', () => {
    render(<LoginPage />)
    expect(screen.getByText('Register')).toBeInTheDocument()
  })
})
