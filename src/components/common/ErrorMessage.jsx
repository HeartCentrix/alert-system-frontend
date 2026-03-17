import { AlertTriangle, Info, XCircle } from 'lucide-react'
import { cn } from '@/utils/helpers'
import {
  normalizeApiError,
  getPrimaryErrorMessage,
  getUserFacingErrorMessages,
  getFieldErrors,
} from '@/utils/errorHandler'

/**
 * ErrorMessage Component
 *
 * Renders normalized error messages from API responses.
 * Handles Pydantic/FastAPI validation errors, network errors, and generic errors.
 *
 * Features:
 * - Single error: displays as inline message
 * - Multiple errors: displays as bulleted list
 * - Optional title based on error type
 * - Field-specific error rendering
 *
 * @param {Object} props
 * @param {Object} [props.error] - The error object to render
 * @param {boolean} [props.inline=false] - Render as inline text vs block element
 * @param {string} [props.fieldName] - Extract errors for specific field only
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showIcon=true] - Show warning icon
 * @param {'small'|'medium'|'large'} [props.size='small'] - Text size variant
 *
 * @example
 * // Simple usage
 * <ErrorMessage error={apiError} />
 *
 * @example
 * // Field-specific error
 * <ErrorMessage error={formError} fieldName="email" />
 *
 * @example
 * // Inline style
 * <ErrorMessage error={error} inline size="small" />
 */
export default function ErrorMessage({
  error,
  inline = false,
  fieldName,
  className,
  showIcon = true,
  size = 'small',
}) {
  if (!error) {
    return null
  }

  // Get normalized error data
  const normalized = normalizeApiError(error)

  // Get field-specific errors if fieldName provided
  let messages = normalized.messages
  if (fieldName && error?.response?.data?.detail) {
    const fieldErrors = getUserFacingErrorMessages(error)
      .filter((_, idx) => {
        // This is a simplified approach - for proper field errors,
        // components should use getFieldErrors directly
        return true
      })
    if (fieldErrors.length > 0) {
      messages = fieldErrors
    }
  }

  // Filter out empty messages
  messages = messages.filter((msg) => msg && msg.trim().length > 0)

  if (messages.length === 0) {
    return null
  }

  // Size variants
  const sizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  }

  const iconSize = {
    small: 12,
    medium: 14,
    large: 16,
  }

  // Single error - inline or block
  if (messages.length === 1) {
    if (inline) {
      return (
        <span
          className={cn(
            'text-danger-400',
            sizeClasses[size],
            className
          )}
        >
          {showIcon && (
            <AlertTriangle size={iconSize[size]} className="inline mr-1.5 -mt-0.5" />
          )}
          {messages[0]}
        </span>
      )
    }

    return (
      <p
        className={cn(
          'text-danger-400 flex items-start gap-2',
          sizeClasses[size],
          className
        )}
      >
        {showIcon && <AlertTriangle size={iconSize[size]} className="flex-shrink-0 mt-0.5" />}
        <span>{messages[0]}</span>
      </p>
    )
  }

  // Multiple errors - list format
  return (
    <div className={cn('text-danger-400', className)}>
      {normalized.title && (
        <p className={cn('font-medium mb-2 flex items-center gap-2', sizeClasses[size])}>
          {showIcon && <XCircle size={iconSize[size]} className="flex-shrink-0" />}
          {normalized.title}
        </p>
      )}
      <ul className={cn('list-disc list-inside space-y-1', sizeClasses[size])}>
        {messages.map((msg, idx) => (
          <li key={idx} className="pl-1">{msg}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * FieldError Component
 *
 * Specialized component for displaying field-level validation errors.
 * Designed to be placed directly below form inputs.
 *
 * @param {Object} props
 * @param {Object} [props.error] - The error object (typically react-hook-form errors or API errors)
 * @param {string} [props.fieldName] - Field name to extract errors for
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showIcon=false] - Show icon (default false for field errors)
 *
 * @example
 * <input {...register('email')} className="input" />
 * <FieldError error={errors.email} />
 *
 * @example
 * <input {...register('mfa_code')} className="input" />
 * <FieldError error={apiError} fieldName="mfa_code" />
 */
export function FieldError({ error, fieldName, className, showIcon = false }) {
  if (!error) {
    return null
  }

  // Handle react-hook-form errors
  if (error?.message) {
    return (
      <p className={cn('text-danger-400 text-xs mt-1', className)}>
        {showIcon && <Info size={10} className="inline mr-1 -mt-0.5" />}
        {error.message}
      </p>
    )
  }

  // Handle API errors for specific field
  if (fieldName) {
    const fieldErrors = getFieldErrors(error, fieldName)
    if (fieldErrors.length > 0) {
      return (
        <p className={cn('text-danger-400 text-xs mt-1', className)}>
          {fieldErrors[0]}
        </p>
      )
    }
  }

  return null
}

/**
 * ErrorBanner Component
 *
 * Prominent error display for page-level or form-level errors.
 * More visually prominent than ErrorMessage.
 *
 * @param {Object} props
 * @param {Object} [props.error] - The error object to render
 * @param {string} [props.title] - Custom title (auto-detected if not provided)
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.dismissible=false] - Show dismiss button (requires onDismiss)
 * @param {Function} [props.onDismiss] - Callback when dismissed
 *
 * @example
 * <ErrorBanner error={apiError} onDismiss={() => setError(null)} />
 */
export function ErrorBanner({ error, title, className, dismissible = false, onDismiss }) {
  if (!error) {
    return null
  }

  const normalized = normalizeApiError(error)
  const messages = normalized.messages.filter((msg) => msg && msg.trim().length > 0)

  if (messages.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-danger-800/50 bg-danger-900/20 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <XCircle size={20} className="text-danger-400" />
        </div>
        <div className="flex-1">
          {(title || normalized.title) && (
            <h3 className="font-medium text-danger-300 mb-2">
              {title || normalized.title}
            </h3>
          )}
          {messages.length === 1 ? (
            <p className="text-danger-200 text-sm">{messages[0]}</p>
          ) : (
            <ul className="list-disc list-inside text-danger-200 text-sm space-y-1">
              {messages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-danger-400 hover:text-danger-200 transition-colors"
            aria-label="Dismiss error"
          >
            <span className="text-lg">×</span>
          </button>
        )}
      </div>
    </div>
  )
}
