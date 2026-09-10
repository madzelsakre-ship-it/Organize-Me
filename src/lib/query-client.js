import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient();

export function createQueryClient() {
  return new QueryClient();
}

export default queryClientInstance;
