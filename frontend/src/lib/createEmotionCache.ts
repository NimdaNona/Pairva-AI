import createCache from '@emotion/cache';

/**
 * Create a client-side Emotion cache for styling
 */
export default function createEmotionCache() {
  return createCache({ key: 'css', prepend: true });
}
