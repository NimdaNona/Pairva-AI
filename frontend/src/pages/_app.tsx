import { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { ThemeProvider, CssBaseline, createTheme, CircularProgress } from '@mui/material';
import createEmotionCache from '@/lib/createEmotionCache';
import * as webVitals from 'web-vitals';

// Dynamic imports for code splitting
const AuthProvider = dynamic(() => import('@/hooks/auth/useAuth').then(mod => mod.AuthProvider), {
  ssr: false,
  loading: () => <CircularProgress />
});

const NotificationsProvider = dynamic(
  () => import('@/hooks/notifications/NotificationsProvider').then(mod => mod.NotificationsProvider), 
  { ssr: false }
);

const SubscriptionProvider = dynamic(
  () => import('@/hooks/subscriptions/useSubscription').then(mod => mod.SubscriptionProvider), 
  { ssr: false }
);

// Performance monitoring function
export function reportWebVitals(metric: any) {
  // Log performance metrics to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(metric);
  }
  
  // In production, send to analytics
  if (process.env.NODE_ENV === 'production') {
    // Example analytics endpoint
    const analyticsEndpoint = '/api/analytics';
    
    // Use `navigator.sendBeacon()` if available
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        analyticsEndpoint,
        JSON.stringify(metric)
      );
    } else {
      // Fall back to fetch API
      fetch(analyticsEndpoint, {
        method: 'POST',
        body: JSON.stringify(metric),
        keepalive: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
}

// Client-side cache, shared for the whole session of the user in the browser
const clientSideEmotionCache = createEmotionCache();

// Light theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#FF6B6B',
    },
    secondary: {
      main: '#4ECDC4',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        },
      },
    },
  },
});

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

export default function MyApp({ 
  Component, 
  pageProps, 
  emotionCache = clientSideEmotionCache 
}: MyAppProps) {
  // Use client-side rendering to avoid hydration issues with auth
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {isMounted ? (
          <AuthProvider>
            <NotificationsProvider>
              <SubscriptionProvider>
                <Component {...pageProps} />
              </SubscriptionProvider>
            </NotificationsProvider>
          </AuthProvider>
        ) : (
          // Simple loading state while waiting for client-side mount
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            width: '100vw' 
          }}>
            Loading...
          </div>
        )}
      </ThemeProvider>
    </CacheProvider>
  );
}
