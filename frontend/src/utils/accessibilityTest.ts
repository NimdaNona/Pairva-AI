/**
 * Accessibility testing utilities for Perfect Match application
 * Uses axe-core for automated accessibility testing
 */
import { AxeResults } from 'axe-core';

/**
 * Run axe accessibility tests on the provided element or the entire document
 * @param element - The element to test, defaults to document
 * @returns Promise that resolves to the axe results
 */
export const runAccessibilityTests = async (element: Element = document.documentElement): Promise<AxeResults> => {
  // Dynamically import axe-core
  const axe = await import('axe-core');
  
  // Configure axe according to our needs
  const config = {
    rules: {
      // Customize rule configuration if needed
      'color-contrast': { enabled: true },
      'keyboard-focusable-modals': { enabled: true },
      'focusable-content': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'duplicate-id': { enabled: true },
      'landmark-banner-is-top-level': { enabled: true },
      'landmark-complementary-is-top-level': { enabled: true },
      'landmark-contentinfo-is-top-level': { enabled: true },
      'landmark-main-is-top-level': { enabled: true },
      'landmark-no-duplicate-banner': { enabled: true },
      'landmark-no-duplicate-contentinfo': { enabled: true },
      'landmark-one-main': { enabled: true },
      'meta-viewport': { enabled: true },
      'region': { enabled: true },
    },
    reporter: 'v2',
  };
  
  // Run the accessibility tests
  return axe.default.run(element, config);
};

/**
 * Checks if all form elements in the provided container have proper labels
 * @param container - The container element to check
 * @returns Array of errors for improperly labeled elements
 */
export const checkFormLabels = (container: Element = document.documentElement): string[] => {
  const errors: string[] = [];
  
  // Get all input, select, and textarea elements
  const formElements = container.querySelectorAll('input, select, textarea');
  
  formElements.forEach((element) => {
    const inputEl = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    
    // Skip hidden, submit, button, and image inputs
    if (inputEl instanceof HTMLInputElement && 
        ['hidden', 'submit', 'button', 'image'].includes(inputEl.type)) {
      return;
    }
    
    // Check if the element has an ID
    const id = inputEl.id;
    if (!id) {
      errors.push(`Element ${inputEl.tagName.toLowerCase()} has no ID for label association`);
      return;
    }
    
    // Check if there's a label with a matching "for" attribute
    const label = document.querySelector(`label[for="${id}"]`);
    
    // Check if the element is wrapped in a label
    const parentLabel = inputEl.closest('label');
    
    // Check aria-labelledby
    const ariaLabelledBy = inputEl.getAttribute('aria-labelledby');
    
    // Check aria-label
    const ariaLabel = inputEl.getAttribute('aria-label');
    
    if (!label && !parentLabel && !ariaLabelledBy && !ariaLabel) {
      errors.push(`No label found for ${inputEl.tagName.toLowerCase()} with ID "${id}"`);
    }
  });
  
  return errors;
};

/**
 * Checks if all interactive elements have sufficient color contrast
 * @param elements - Array of elements to check
 * @returns Promise that resolves to array of contrast issues
 */
export const checkContrastRatio = async (elements: Element[] = Array.from(document.querySelectorAll('button, a, input, select, textarea'))): Promise<{element: Element, ratio: number, required: number}[]> => {
  const issues: {element: Element, ratio: number, required: number}[] = [];
  
  for (const element of elements) {
    const style = window.getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const color = style.color;
    
    // Convert colors to RGB values for contrast calculation
    const backgroundRGB = convertToRGB(backgroundColor);
    const textRGB = convertToRGB(color);
    
    if (backgroundRGB && textRGB) {
      const ratio = calculateContrastRatio(textRGB, backgroundRGB);
      
      // Determine required contrast based on text size
      // Large text is defined as 18pt or 14pt bold
      const fontSize = parseInt(style.fontSize);
      const fontWeight = style.fontWeight;
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= '700');
      const requiredRatio = isLargeText ? 3 : 4.5;
      
      if (ratio < requiredRatio) {
        issues.push({
          element,
          ratio,
          required: requiredRatio
        });
      }
    }
  }
  
  return issues;
};

/**
 * Check if tab key navigation works as expected
 * @returns Array of keyboard navigation issues
 */
export const checkKeyboardNavigation = (): string[] => {
  const issues: string[] = [];
  
  // Get all focusable elements
  const focusableElements = document.querySelectorAll(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  // Check for positive tabindex (should be avoided)
  focusableElements.forEach((element) => {
    const tabindex = element.getAttribute('tabindex');
    if (tabindex && parseInt(tabindex) > 0) {
      issues.push(`Element has positive tabindex (${tabindex}), which should be avoided for natural tab order`);
    }
  });
  
  // Check for keyboard traps in modals
  const modalElements = document.querySelectorAll('[role="dialog"], dialog');
  modalElements.forEach((modal) => {
    // Get focusable elements within modal
    const focusableWithinModal = modal.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableWithinModal.length === 0) {
      issues.push('Modal dialog has no focusable elements');
    }
  });
  
  return issues;
};

// Helper functions

/**
 * Convert CSS color string to RGB array
 * @param color - CSS color (hex, rgb, rgba)
 * @returns RGB array or null if conversion failed
 */
function convertToRGB(color: string): [number, number, number] | null {
  // Handle RGB and RGBA format
  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  const rgbaMatch = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d*(?:\.\d+)?)\)$/i);
  
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10)
    ];
  } else if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10),
      parseInt(rgbaMatch[2], 10),
      parseInt(rgbaMatch[3], 10)
    ];
  }
  
  // Handle hex format
  const hex = color.match(/^#?(([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2}))$/i);
  if (hex) {
    return [
      parseInt(hex[2], 16),
      parseInt(hex[3], 16),
      parseInt(hex[4], 16)
    ];
  }
  
  return null;
}

/**
 * Calculate contrast ratio between two colors
 * @param color1 - First RGB color
 * @param color2 - Second RGB color
 * @returns Contrast ratio (1-21)
 */
function calculateContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  // Calculate luminance for each color
  const l1 = calculateLuminance(color1);
  const l2 = calculateLuminance(color2);
  
  // Calculate contrast ratio
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Calculate relative luminance of RGB color
 * @param rgb - RGB color
 * @returns Relative luminance
 */
function calculateLuminance(rgb: [number, number, number]): number {
  // Convert RGB values to sRGB
  const sRGB = rgb.map(val => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  
  // Calculate luminance using the formula from WCAG 2.0
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * Format and print accessibility issues to the console
 * @param results - Axe test results
 */
export const printAccessibilityIssues = (results: AxeResults): void => {
  console.group('Accessibility Test Results');
  
  if (results.violations.length === 0) {
    console.log('✅ No accessibility violations found!');
  } else {
    console.error(`❌ Found ${results.violations.length} accessibility violations:`);
    
    results.violations.forEach((violation, index) => {
      console.group(`${index + 1}. ${violation.id}: ${violation.help}`);
      console.log(`Impact: ${violation.impact}`);
      console.log(`Description: ${violation.description}`);
      console.log(`WCAG: ${violation.tags.filter(tag => tag.startsWith('wcag')).join(', ')}`);
      console.log('Affected elements:');
      violation.nodes.forEach(node => {
        console.log(`- ${node.html}`);
        console.log(`  Fix: ${node.failureSummary}`);
      });
      console.groupEnd();
    });
  }
  
  console.log(`\nPassed tests: ${results.passes.length}`);
  console.log(`Inapplicable tests: ${results.inapplicable.length}`);
  console.log(`Incomplete tests: ${results.incomplete.length}`);
  
  console.groupEnd();
};

/**
 * Run a comprehensive accessibility audit
 * @param element - Root element to test
 * @returns Promise that resolves to a summary of all issues
 */
export const runAccessibilityAudit = async (element: Element = document.documentElement): Promise<{
  axeViolations: number;
  formLabelIssues: string[];
  contrastIssues: {element: Element, ratio: number, required: number}[];
  keyboardIssues: string[];
}> => {
  // Run all tests
  const axeResults = await runAccessibilityTests(element);
  const formLabelIssues = checkFormLabels(element);
  const contrastIssues = await checkContrastRatio();
  const keyboardIssues = checkKeyboardNavigation();
  
  // Print detailed results to console
  printAccessibilityIssues(axeResults);
  
  if (formLabelIssues.length > 0) {
    console.group('Form Label Issues');
    formLabelIssues.forEach(issue => console.log(`- ${issue}`));
    console.groupEnd();
  }
  
  if (contrastIssues.length > 0) {
    console.group('Contrast Issues');
    contrastIssues.forEach(issue => {
      console.log(`- Element: ${(issue.element as HTMLElement).outerHTML.substring(0, 100)}...`);
      console.log(`  Ratio: ${issue.ratio.toFixed(2)} (Required: ${issue.required})`);
    });
    console.groupEnd();
  }
  
  if (keyboardIssues.length > 0) {
    console.group('Keyboard Navigation Issues');
    keyboardIssues.forEach(issue => console.log(`- ${issue}`));
    console.groupEnd();
  }
  
  // Return summary
  return {
    axeViolations: axeResults.violations.length,
    formLabelIssues,
    contrastIssues,
    keyboardIssues
  };
};
