import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { login } from '@/lib/auth/authUtils';

interface LoginButtonProps extends Omit<ButtonProps, 'onClick'> {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  fullWidth?: boolean;
}

/**
 * A button component that initiates the Cognito login flow
 */
const LoginButton: React.FC<LoginButtonProps> = ({ 
  children = 'Sign In', 
  variant = 'contained',
  size = 'medium',
  color = 'primary',
  fullWidth = false,
  ...props 
}) => {
  const handleLogin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    login();
  };

  return (
    <Button
      variant={variant}
      size={size}
      color={color}
      fullWidth={fullWidth}
      onClick={handleLogin}
      {...props}
    >
      {children}
    </Button>
  );
};

export default LoginButton;
