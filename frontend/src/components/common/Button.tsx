import React from 'react';
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
  CircularProgress
} from '@mui/material';
import { createKeyboardHandler } from '@/utils/accessibility';

/**
 * Extended props for our accessible button component
 */
export interface ButtonProps extends Omit<MuiButtonProps, 'startIcon' | 'endIcon'> {
  /**
   * Content to render inside the button
   */
  children: React.ReactNode;
  
  /**
   * Icon to display at the start of the button
   */
  startIcon?: React.ReactNode;
  
  /**
   * Icon to display at the end of the button
   */
  endIcon?: React.ReactNode;
  
  /**
   * Loading state of the button
   */
  loading?: boolean;
  
  /**
   * Aria label for improved accessibility
   */
  ariaLabel?: string;
  
  /**
   * Additional description for screen readers
   */
  ariaDescription?: string;
  
  /**
   * Prevent focus styles when clicked with mouse
   */
  preventFocusStylesOnClick?: boolean;
}

/**
 * An accessible button component that extends Material UI's Button
 * with additional accessibility features and loading state.
 */
const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  ariaLabel,
  ariaDescription,
  preventFocusStylesOnClick = false,
  ...props
}) => {
  // Reference to track if button was clicked with mouse
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const wasMouseDown = React.useRef(false);
  
  // Handle mouse down to track click origin
  const handleMouseDown = React.useCallback(() => {
    wasMouseDown.current = true;
  }, []);
  
  // Handle onClick with loading state management
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent focus styles when clicked with mouse if requested
      if (preventFocusStylesOnClick && wasMouseDown.current && buttonRef.current) {
        buttonRef.current.blur();
      }
      
      // Reset tracking
      wasMouseDown.current = false;
      
      // Call original onClick if provided and not loading/disabled
      if (onClick && !loading && !disabled) {
        onClick(event);
      }
    },
    [onClick, loading, disabled, preventFocusStylesOnClick]
  );
  
  // Create keyboard handler for better accessibility
  const keyboardHandler = createKeyboardHandler(() => {
    if (!loading && !disabled && buttonRef.current) {
      buttonRef.current.click();
    }
  });
  
  return (
    <MuiButton
      ref={buttonRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onKeyDown={keyboardHandler}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
      endIcon={endIcon}
      aria-label={ariaLabel}
      aria-describedby={ariaDescription ? `desc-${ariaLabel?.replace(/\s+/g, '-').toLowerCase()}` : undefined}
      {...props}
    >
      {children}
      {ariaDescription && (
        <span
          id={`desc-${ariaLabel?.replace(/\s+/g, '-').toLowerCase()}`}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0
          }}
        >
          {ariaDescription}
        </span>
      )}
    </MuiButton>
  );
};

export default Button;
