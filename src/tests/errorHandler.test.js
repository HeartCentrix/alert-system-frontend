/**
 * Tests for error handling utility
 * 
 * Verifies that API errors are properly normalized and
 * never cause React crashes from rendering raw objects.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeApiError,
  getUserFacingErrorMessages,
  getPrimaryErrorMessage,
  getFieldErrors,
} from '../utils/errorHandler'

describe('Error Handler Utility', () => {
  describe('normalizeApiError', () => {
    it('handles null/undefined errors', () => {
      const result1 = normalizeApiError(null)
      const result2 = normalizeApiError(undefined)
      
      expect(result1.messages).toHaveLength(1)
      expect(result1.messages[0]).toContain('unexpected error')
      expect(result2.messages).toHaveLength(1)
    })

    it('handles plain string errors', () => {
      const result = normalizeApiError('Simple error message')
      expect(result.messages).toEqual(['Simple error message'])
    })

    it('handles Pydantic/FastAPI validation errors', () => {
      const error = {
        response: {
          data: {
            detail: [
              {
                type: 'string_pattern_mismatch',
                loc: ['body', 'mfa_code'],
                msg: "String should match pattern '^\\d{6}$'",
                input: 'abcdef'
              }
            ]
          }
        }
      }

      const result = normalizeApiError(error)
      expect(result.title).toBe('Validation Error')
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0]).toContain('Mfa_code')
      expect(result.messages[0]).not.toContain('object')
    })

    it('handles multiple validation errors', () => {
      const error = {
        response: {
          data: {
            detail: [
              {
                type: 'string_too_short',
                loc: ['body', 'password'],
                msg: 'String should have at least 8 characters',
                input: 'short'
              },
              {
                type: 'missing',
                loc: ['body', 'email'],
                msg: 'Field required',
                input: undefined
              }
            ]
          }
        }
      }
      
      const result = normalizeApiError(error)
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0]).toContain('Password')
      expect(result.messages[1]).toContain('Email')
    })

    it('handles detail as string', () => {
      const error = {
        response: {
          data: {
            detail: 'Simple error message from server'
          }
        }
      }
      
      const result = normalizeApiError(error)
      expect(result.messages).toEqual(['Simple error message from server'])
    })

    it('handles { message: string } format', () => {
      const error = {
        response: {
          data: {
            message: 'Error from message field'
          }
        }
      }
      
      const result = normalizeApiError(error)
      expect(result.messages).toEqual(['Error from message field'])
    })

    it('handles network errors', () => {
      const error1 = { code: 'ECONNREFUSED' }
      const error2 = { code: 'ENOTFOUND' }
      const error3 = { request: {}, message: 'Network Error' }

      const result1 = normalizeApiError(error1)
      expect(result1.title).toBe('Connection Error')

      const result2 = normalizeApiError(error2)
      expect(result2.title).toBe('Network Error')

      const result3 = normalizeApiError(error3)
      expect(result3.title).toBeUndefined() // No title for generic network errors without specific codes
    })

    it('never renders raw objects as strings', () => {
      // This is the main bug fix - ensure objects are never rendered
      const error = {
        response: {
          data: {
            detail: [{ type: 'test', loc: ['field'], msg: 'error' }]
          }
        }
      }
      
      const result = normalizeApiError(error)
      result.messages.forEach(msg => {
        expect(typeof msg).toBe('string')
        expect(msg).not.toContain('[object Object]')
        expect(msg).not.toContain('type:')
      })
    })
  })

  describe('getUserFacingErrorMessages', () => {
    it('returns string array', () => {
      const error = { response: { data: { detail: 'Error' } } }
      const result = getUserFacingErrorMessages(error)
      expect(Array.isArray(result)).toBe(true)
      expect(result.every(m => typeof m === 'string')).toBe(true)
    })
  })

  describe('getPrimaryErrorMessage', () => {
    it('returns single string', () => {
      const error = { response: { data: { detail: 'Primary error' } } }
      const result = getPrimaryErrorMessage(error)
      expect(typeof result).toBe('string')
      expect(result).toBe('Primary error')
    })

    it('returns fallback for unknown errors', () => {
      const result = getPrimaryErrorMessage({})
      expect(result).toContain('unexpected error')
    })
  })

  describe('getFieldErrors', () => {
    it('extracts errors for specific field', () => {
      const error = {
        response: {
          data: {
            detail: [
              { type: 'required', loc: ['body', 'email'], msg: 'Email is required' },
              { type: 'invalid', loc: ['body', 'password'], msg: 'Password invalid' }
            ]
          }
        }
      }
      
      const emailErrors = getFieldErrors(error, 'email')
      expect(emailErrors).toHaveLength(1)
      expect(emailErrors[0]).toContain('Email')
      
      const passwordErrors = getFieldErrors(error, 'password')
      expect(passwordErrors).toHaveLength(1)
    })

    it('returns empty array for no matching errors', () => {
      const error = {
        response: {
          data: {
            detail: [
              { type: 'required', loc: ['body', 'email'], msg: 'Email is required' }
            ]
          }
        }
      }
      
      const result = getFieldErrors(error, 'nonexistent')
      expect(result).toHaveLength(0)
    })
  })
})
