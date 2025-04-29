/**
 * Accessibility utilities for the Perfect Match application
 * These functions enhance the application's accessibility for users with disabilities
 */

/**
 * Global screen reader announcement element
 * This is used to make announcements to screen readers without changing focus
 */
let announcementElement: HTMLElement | null = null;

/**
 * Skip link for keyboard navigation
 */
let skipLink: HTMLElement | null = null;

/**
 * Initialize the announcement element
 * This creates a visually hidden element that will be used to announce messages to screen readers
 */
function initializeAnnouncementElement(): HTMLElement {
  if (typeof document === 'undefined') {
    // Return a stub for SSR
    return {} as HTMLElement;
  }

  if (!announcementElement) {
    announcementElement = document.createElement('div');
    announcementElement.setAttribute('aria-live', 'polite');
    announcementElement.setAttribute('aria-atomic', 'true');
    announcementElement.setAttribute('id', 'screen-reader-announcement');
    announcementElement.setAttribute('role', 'status');
    // Hide element visually but keep it accessible to screen readers
    announcementElement.style.position = 'absolute';
    announcementElement.style.width = '1px';
    announcementElement.style.height = '1px';
    announcementElement.style.padding = '0';
    announcementElement.style.margin = '-1px';
    announcementElement.style.overflow = 'hidden';
    announcementElement.style.clip = 'rect(0, 0, 0, 0)';
    announcementElement.style.whiteSpace = 'nowrap';
    announcementElement.style.border = '0';

    document.body.appendChild(announcementElement);
  }

  return announcementElement;
}

/**
 * Add a skip navigation link to the page for keyboard users
 * @param targetId The ID of the element to skip to
 * @param label Optional custom label for the skip link
 */
export function addSkipLink(targetId: string, label: string = 'Skip to main content'): void {
  if (typeof document === 'undefined') return;
  
  // Remove existing skip link if present
  if (skipLink && skipLink.parentNode) {
    skipLink.parentNode.removeChild(skipLink);
  }
  
  // Create new skip link
  skipLink = document.createElement('a');
  skipLink.setAttribute('id', 'skip-link');
  skipLink.setAttribute('href', `#${targetId}`);
  skipLink.textContent = label;
  
  // Style the skip link - only visible on focus
  skipLink.style.position = 'absolute';
  skipLink.style.top = '0';
  skipLink.style.left = '0';
  skipLink.style.padding = '10px 15px';
  skipLink.style.background = '#007bff';
  skipLink.style.color = '#ffffff';
  skipLink.style.fontWeight = 'bold';
  skipLink.style.textDecoration = 'none';
  skipLink.style.zIndex = '9999';
  skipLink.style.opacity = '0';
  skipLink.style.transform = 'translateY(-100%)';
  skipLink.style.transition = 'transform 0.3s, opacity 0.3s';
  
  // When focused, make visible
  skipLink.addEventListener('focus', () => {
    skipLink!.style.opacity = '1';
    skipLink!.style.transform = 'translateY(0)';
  });
  
  // When focus lost, hide again
  skipLink.addEventListener('blur', () => {
    skipLink!.style.opacity = '0';
    skipLink!.style.transform = 'translateY(-100%)';
  });
  
  // Ensure the target exists and has proper tabindex
  const target = document.getElementById(targetId);
  if (target && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  
  // Add to DOM as first element
  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Announce a message to screen readers
 * @param message The message to announce
 * @param assertive If true, interrupts current announcement (use sparingly)
 */
export function announceToScreenReader(message: string, assertive = false): void {
  // Initialize if we're in the browser
  if (typeof window !== 'undefined') {
    const element = initializeAnnouncementElement();
    
    // Set politeness level
    element.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    
    // Clear previous content to ensure announcement triggers
    element.textContent = '';
    
    // Use setTimeout to ensure the DOM update is processed
    setTimeout(() => {
      element.textContent = message;
    }, 50);
  }
}

/**
 * Focus management utility to improve keyboard navigation
 * @param selector CSS selector for the element to focus
 * @param announcement Optional message to announce when focusing
 */
export function focusElement(selector: string, announcement?: string): void {
  if (typeof document === 'undefined') return;

  const element = document.querySelector(selector) as HTMLElement;
  if (element) {
    element.focus();
    if (announcement) {
      announceToScreenReader(announcement);
    }
  }
}

/**
 * Create an accessible keyboard handler for interactive elements
 * @param callback The function to call when the key is pressed
 * @returns A function that can be used as an onKeyDown handler
 */
export function createKeyboardHandler(callback: () => void) {
  return (event: { key: string; preventDefault: () => void }): void => {
    // Handle both Space and Enter key presses for interactive elements
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };
}

/**
 * Check if an element is currently visible to screen readers
 * @param element The element to check
 * @returns true if the element is accessible to screen readers
 */
export function isAccessibleToScreenReaders(element: HTMLElement): boolean {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  
  // Check common ways elements are hidden
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  
  // Check if element has aria-hidden attribute
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  
  // Check if any parent has aria-hidden="true"
  let parent = element.parentElement;
  while (parent) {
    if (parent.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    parent = parent.parentElement;
  }
  
  return true;
}

/**
 * Generate an accessible label for an element
 * @param baseLabel The base label for the element
 * @param state Additional state information to append
 * @returns A comprehensive accessible label
 */
export function generateAccessibleLabel(baseLabel: string, state?: Record<string, any>): string {
  if (!state) return baseLabel;
  
  let fullLabel = baseLabel;
  
  // Add state information to the label
  Object.entries(state).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      fullLabel += `, ${key}: ${value}`;
    }
  });
  
  return fullLabel;
}
