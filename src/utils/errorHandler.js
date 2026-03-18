/**
 * Converts API errors (Pydantic/FastAPI validation errors) into
 * user-friendly strings for display.
 */

/**
 * @param {Object} errorItem
 * @returns {string}
 */
function normalizePydanticError(errorItem) {
  if (!errorItem || typeof errorItem !== 'object') {
    return String(errorItem || 'An unexpected error occurred')
  }

  const { type, loc, msg, input } = errorItem

  // Extract field name from location array
  // loc is typically ["body", "field_name"] or just ["field_name"]
  let fieldName = 'Field'
  if (Array.isArray(loc) && loc.length > 0) {
    // Get the last part which is usually the field name
    fieldName = loc[loc.length - 1]
    // Capitalize first letter
    fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
  }

  // Map common Pydantic error types to user-friendly messages
  const errorTypeMessages = {
    // String validation
    string_pattern_mismatch: (field) => `${field} has an invalid format`,
    string_too_short: (field) => `${field} is too short`,
    string_too_long: (field) => `${field} is too long`,
    
    // Numeric validation
    greater_than: (field) => `${field} must be greater than the allowed value`,
    less_than: (field) => `${field} must be less than the allowed value`,
    greater_than_equal: (field) => `${field} must be at least the minimum value`,
    less_than_equal: (field) => `${field} must be at most the maximum value`,
    
    // Type validation
    float_type: (field) => `${field} must be a number`,
    int_type: (field) => `${field} must be an integer`,
    bool_type: (field) => `${field} must be true or false`,
    list_type: (field) => `${field} must be a list`,
    dict_type: (field) => `${field} must be an object`,
    string_type: (field) => `${field} must be text`,
    
    // Required/missing
    missing: (field) => `${field} is required`,
    
    // Email
    value_error: (field, ctx) => {
      if (msg?.includes('email')) return `${field} must be a valid email address`
      return `${field} has an invalid value`
    },
    
    // Length
    too_short: (field) => `${field} is too short`,
    too_long: (field) => `${field} is too long`,
  }

  // Try to get a friendly message based on error type
  const typeMapper = errorTypeMessages[type]
  if (typeMapper) {
    return typeMapper(fieldName, errorItem.ctx)
  }

  // If we have a msg field, use it but sanitize it
  // Remove technical details that shouldn't be shown to users
  if (msg) {
    // Remove regex patterns and internal details
    let cleanMsg = msg
      .replace(/regex pattern ['"]?[^'"]*['"]?/gi, 'format')
      .replace(/pattern ['"]?[^'"]*['"]?/gi, 'format')
      .replace(/should match ['"]?[^'"]*['"]?/gi, 'have the correct format')
    
    // If msg already contains field info, use it directly
    if (cleanMsg.toLowerCase().includes(fieldName.toLowerCase())) {
      return cleanMsg
    }
    
    return `${fieldName}: ${cleanMsg}`
  }

  // Fallback: generic message with field name
  return `${fieldName} is invalid`
}

// ── Individual format extractors ──────────────────────────────────────────────

function extractFromStringError(error) {
  if (typeof error === 'string') {
    return { messages: [error || 'An error occurred'] }
  }
  return null
}

function extractFromStringData(data) {
  if (typeof data === 'string') {
    return { messages: [data] }
  }
  return null
}

function extractFromDetailString(data) {
  if (data?.detail && typeof data.detail === 'string') {
    return { messages: [data.detail] }
  }
  return null
}

function extractFromDetailArray(data) {
  if (!Array.isArray(data?.detail)) return null
  const messages = data.detail
    .map((err) => normalizePydanticError(err))
    .filter((msg) => msg && msg.length > 0)
  if (messages.length > 0) {
    return { title: 'Validation Error', messages }
  }
  return null
}

function normalizeErrorsItem(err) {
  if (err.type || err.loc) return normalizePydanticError(err)
  if (typeof err.message === 'string') return err.message
  return normalizePydanticError(err)
}

function extractFromErrorsArray(data) {
  if (!Array.isArray(data?.errors)) return null
  const messages = data.errors
    .map(normalizeErrorsItem)
    .filter((msg) => msg && msg.length > 0)
  if (messages.length > 0) {
    return { title: 'Validation Error', messages }
  }
  return null
}

function extractFromMessage(data) {
  if (!data?.message) return null
  if (Array.isArray(data.message)) {
    return { messages: data.message.filter((msg) => msg && typeof msg === 'string') }
  }
  if (typeof data.message === 'string') {
    return { messages: [data.message] }
  }
  return null
}

function extractFromErrorField(data) {
  if (data?.error && typeof data.error === 'string') {
    return { messages: [data.error] }
  }
  return null
}

function extractFromNetworkError(error) {
  if (error?.code === 'ECONNREFUSED') {
    return {
      title: 'Connection Error',
      messages: ['Unable to connect to the server. Please check your connection and try again.'],
    }
  }
  if (error?.code === 'ENOTFOUND') {
    return {
      title: 'Network Error',
      messages: ['Cannot reach the server. Please check your network connection.'],
    }
  }
  if (error?.request && !error?.response) {
    return {
      title: 'Network Error',
      messages: ['No response from server. Please check your internet connection.'],
    }
  }
  return null
}

function extractFromObjectFallback(data) {
  if (!data || typeof data !== 'object') return null
  const possibleMessages = ['detail', 'message', 'error', 'errorMessage', 'errorMsg']
  for (const key of possibleMessages) {
    if (data[key] && typeof data[key] === 'string') {
      return { messages: [data[key]] }
    }
  }
  return null
}

/**
 * Extract and normalize error messages from an API error response.
 * 
 * Handles multiple error response formats:
 * - FastAPI/Pydantic: { detail: [...] } or { detail: "string" }
 * - Generic: { message: "..." } or { error: "..." }
 * - Array of errors: { errors: [...] }
 * - Plain string errors
 * 
 * @param {Object} error - The caught error object (from axios/fetch)
 * @returns {{ title?: string, messages: string[] }} - Normalized error with optional title and message list
 */
export function normalizeApiError(error) {
  const defaultResponse = {
    title: undefined,
    messages: ['An unexpected error occurred. Please try again.'],
  }

  if (!error) return defaultResponse

  const data = error?.response?.data || error?.detail || error

  return (
    extractFromStringError(error) ||
    extractFromStringData(data) ||
    extractFromDetailString(data) ||
    extractFromDetailArray(data) ||
    extractFromErrorsArray(data) ||
    extractFromMessage(data) ||
    extractFromErrorField(data) ||
    extractFromNetworkError(error) ||
    extractFromObjectFallback(data) ||
    defaultResponse
  )
}

/**
 * Get user-facing error messages as a simple string array.
 * 
 * Convenience wrapper around normalizeApiError for simple use cases.
 * 
 * @param {Object} error - The caught error object
 * @returns {string[]} - Array of error messages
 */
export function getUserFacingErrorMessages(error) {
  const normalized = normalizeApiError(error)
  return normalized.messages
}

/**
 * Get a single primary error message.
 * 
 * Useful when you only want to display one error.
 * 
 * @param {Object} error - The caught error object
 * @returns {string} - Primary error message
 */
export function getPrimaryErrorMessage(error) {
  const normalized = normalizeApiError(error)
  return normalized.messages[0] || 'An unexpected error occurred'
}

/**
 * Field-specific error message getter.
 *
 * Extracts errors for a specific field from validation error responses.
 *
 * @param {Object} error - The caught error object
 * @param {string} fieldName - The field name to extract errors for
 * @returns {string[]} - Array of error messages for the specific field
 */
export function getFieldErrors(error, fieldName) {
  if (!error?.response?.data?.detail || !Array.isArray(error.response.data.detail)) {
    return []
  }

  return error.response.data.detail
    .filter((err) => {
      if (!err.loc || !Array.isArray(err.loc)) return false
      // Check if field name appears in location path
      return err.loc.includes(fieldName)
    })
    .map((err) => normalizePydanticError(err))
    .filter((msg) => msg && msg.length > 0)
}

// Note: For JSX rendering of error messages, use the ErrorMessage component:
// import ErrorMessage from '@/components/common/ErrorMessage'
// <ErrorMessage error={error} />
