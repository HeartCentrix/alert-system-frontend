import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function LDAPLoginForm({
  username,
  setUsername,
  password,
  setPassword,
  onSubmit,
  loading,
  showPassword,
  setShowPassword
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Username</label>
        <input
          type="text"
          className="input"
          placeholder="Enter your AD username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="input pr-10"
            placeholder="Enter your AD password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
