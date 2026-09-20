/**
 * Login Page – Secure Client-Side Logic
 * Implements frontend-security-coder best practices:
 * - XSS prevention via textContent over innerHTML
 * - Allowlist input validation
 * - Secure DOM manipulation
 * - CSP-compatible event handling
 * - No inline scripts/styles
 */

(() => {
  'use strict';

  /* --- DOM References --- */
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  const passwordToggle = document.querySelector('.password-toggle');
  const eyeIcon = passwordToggle.querySelector('.icon-eye');
  const eyeOffIcon = passwordToggle.querySelector('.icon-eye-off');

  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');

  const toastContainer = document.getElementById('toast-container');

  /* --- Constants & Allowlists --- */
  const EMAIL_MAX_LENGTH = 254;
  const PASSWORD_MAX_LENGTH = 128;
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  /* --- Utility Functions --- */

  /**
   * Safely set text content – prevents XSS
   * @param {HTMLElement} element
   * @param {string} text
   */
  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Safely toggle error visibility
   * @param {HTMLElement} element
   * @param {boolean} visible
   */
  function toggleError(element, visible) {
    if (element) {
      element.classList.toggle('visible', visible);
    }
  }

  /**
   * Validate email using allowlist regex
   * @param {string} value
   * @returns {boolean}
   */
  function isValidEmail(value) {
    if (!value || value.length > EMAIL_MAX_LENGTH) {
      return false;
    }
    return EMAIL_REGEX.test(value);
  }

  /**
   * Validate password length
   * @param {string} value
   * @returns {boolean}
   */
  function isValidPassword(value) {
    return value && value.length > 0 && value.length <= PASSWORD_MAX_LENGTH;
  }

  /**
   * Show toast notification (secure – uses textContent)
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   * @param {number} duration
   */
  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    // Safe text insertion – no innerHTML
    setText(toast, message);

    toastContainer.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Set loading state on submit button
   * @param {boolean} loading
   */
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('btn--loading', loading);
    btnText.textContent = loading ? 'Signing in...' : 'Sign in';
  }

  /* --- Input Validation --- */

  /**
   * Validate single field and show error if needed
   * @param {HTMLInputElement} input
   * @param {Function} validator
   * @param {HTMLElement} errorElement
   * @param {string} errorMessage
   * @returns {boolean}
   */
  function validateField(input, validator, errorElement, errorMessage) {
    const isValid = validator(input.value.trim());
    if (!isValid && input.value.length > 0) {
      input.classList.add('error');
      setText(errorElement, errorMessage);
      toggleError(errorElement, true);
    } else {
      input.classList.remove('error');
      toggleError(errorElement, false);
    }
    return isValid;
  }

  // Real-time validation on blur
  emailInput.addEventListener('blur', () => {
    validateField(emailInput, isValidEmail, emailError, 'Please enter a valid email address');
  });

  passwordInput.addEventListener('blur', () => {
    validateField(passwordInput, isValidPassword, passwordError, 'Password is required');
  });

  // Clear error on input
  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('error');
    toggleError(emailError, false);
  });

  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('error');
    toggleError(passwordError, false);
  });

  /* --- Password Visibility Toggle --- */
  passwordToggle.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', isHidden);
    eyeIcon.style.display = isHidden ? 'none' : 'block';
    eyeOffIcon.style.display = isHidden ? 'block' : 'none';
  });

  /* --- Form Submission --- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Validate all fields
    const emailValid = validateField(
      emailInput,
      isValidEmail,
      emailError,
      'Please enter a valid email address'
    );

    const passwordValid = validateField(
      passwordInput,
      isValidPassword,
      passwordError,
      'Password is required'
    );

    if (!emailValid || !passwordValid) {
      // Focus first invalid field
      if (!emailValid) emailInput.focus();
      else if (!passwordValid) passwordInput.focus();
      return;
    }

    setLoading(true);

    try {
      // Simulate API call – replace with actual endpoint
      await mockAuthRequest(emailInput.value.trim(), passwordInput.value);

      // Success
      showToast('Sign in successful. Redirecting...', 'success');
      form.reset();

      // In production: redirect to dashboard or use server-side session
      // window.location.href = '/dashboard';
    } catch (error) {
      // Secure error handling – don't expose internal details
      console.error('Auth error:', error);
      showToast('Invalid email or password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  });

  /**
   * Mock authentication request (replace with real API call)
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  function mockAuthRequest(email, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Demo: accept any valid email with password length >= 8
        if (email.includes('@') && password.length >= 8) {
          resolve();
        } else {
          reject(new Error('Authentication failed'));
        }
      }, 1200);
    });
  }

  /* --- Accessibility: Enter key on password toggle --- */
  passwordToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      passwordToggle.click();
    }
  });

  /* --- Prevent form resubmission on page refresh --- */
  if (window.history.replaceState) {
    window.history.replaceState(null, '', window.location.href);
  }
})();