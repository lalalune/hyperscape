/**
 * Test Error Reporting Utilities
 * 
 * This module provides utilities for testing error reporting in development.
 * It simulates various error scenarios to ensure error handling works correctly.
 */

import { errorReporting } from './error-reporting';

// Test utilities for development only
if (process.env.NODE_ENV === 'development') {
  // Add test error buttons to the page
  const testContainer = document.createElement('div');
  testContainer.id = 'error-test-container';
  testContainer.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    display: none;
  `;

  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Toggle Error Tests';
  toggleButton.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: #ff4444;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
  `;

  toggleButton.onclick = () => {
    testContainer.style.display = testContainer.style.display === 'none' ? 'block' : 'none';
  };

  // Create test buttons
  const tests = [
    {
      name: 'Throw JS Error',
      action: () => {
        throw new Error('Test JavaScript Error');
      }
    },
    {
      name: 'Unhandled Promise Rejection',
      action: () => {
        Promise.reject(new Error('Test Unhandled Promise Rejection'));
      }
    },
    {
      name: 'Custom Error',
      action: () => {
        errorReporting.reportCustomError('Test Custom Error', {
          testData: 'This is test context',
          timestamp: Date.now()
        });
      }
    },
    {
      name: 'Network Error',
      action: async () => {
        try {
          const response = await fetch('https://invalid-domain-that-does-not-exist.com');
          await response.json();
        } catch (_error) {
          errorReporting.reportCustomError('Network Error Test', {
            error: _error instanceof Error ? _error.message : String(_error),
            type: 'network'
          });
        }
      }
    },
    {
      name: 'Type Error',
      action: () => {
        const obj = null;
        // @ts-ignore - Intentional type error for testing
        obj.someMethod();
      }
    },
    {
      name: 'Reference Error',
      action: () => {
        // @ts-ignore - Intentional reference error for testing
        // eslint-disable-next-line no-undef
        someUndefinedVariable.doSomething();
      }
    }
  ];

  tests.forEach(test => {
    const button = document.createElement('button');
    button.textContent = test.name;
    button.style.cssText = `
      display: block;
      width: 100%;
      margin: 5px 0;
      padding: 5px;
      background: #333;
      color: white;
      border: 1px solid #555;
      cursor: pointer;
      font-family: monospace;
      font-size: 12px;
    `;
    button.onclick = () => {
      test.action();
    };
    testContainer.appendChild(button);
  });

  // Add to page when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(toggleButton);
      document.body.appendChild(testContainer);
    });
  } else {
    document.body.appendChild(toggleButton);
    document.body.appendChild(testContainer);
  }

  console.log('Error reporting test utilities loaded. Click the red button in the bottom right to test errors.');
}

// Export a dummy object to satisfy module requirements
export const errorTestUtils = {
  enabled: process.env.NODE_ENV === 'development'
}; 