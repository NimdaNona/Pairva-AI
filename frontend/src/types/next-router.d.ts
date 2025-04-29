// Type declarations for next/router
declare module 'next/router' {
  import { NextRouter } from 'next/dist/client/router';
  
  export { NextRouter };
  export function useRouter(): NextRouter;
}
