import { useState, useCallback, useEffect } from 'react';
import matchesApi, {
  Match,
  PaginatedMatches,
  CompatibilityInsight,
  MatchFilterParams,
  MatchStatus
} from '../../lib/matches/matchesApi';

interface MatchesState {
  matches: Match[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: MatchesState = {
  matches: [],
  total: 0,
  loading: false,
  error: null
};

export interface MatchesActions {
  // Get all matches for the current user
  getMatches: (options?: {
    limit?: number;
    page?: number;
    status?: MatchStatus;
    minScore?: number;
  }) => Promise<void>;

  // Get a specific match by ID
  getMatch: (matchId: string) => Promise<Match | null>;

  // Get compatibility insights for a match
  getCompatibilityInsight: (matchId: string) => Promise<CompatibilityInsight | null>;

  // Like or unlike a match
  updateLikeStatus: (matchId: string, liked: boolean) => Promise<Match | null>;

  // Search matches with filtering
  searchMatches: (params?: MatchFilterParams) => Promise<void>;

  // Reset matches state
  resetMatches: () => void;
}

/**
 * Hook for managing matches and their related operations
 */
const useMatches = (): [MatchesState, MatchesActions] => {
  const [state, setState] = useState<MatchesState>(initialState);

  // Get all matches for the current user
  const getMatches = useCallback(async (options = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await matchesApi.getMatches(options);
      setState(prev => ({
        ...prev,
        matches: response.items,
        total: response.total,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error fetching matches'
      }));
      console.error('Error fetching matches:', error);
    }
  }, []);

  // Get a specific match by ID
  const getMatch = useCallback(async (matchId: string): Promise<Match | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const match = await matchesApi.getMatch(matchId);
      setState(prev => ({ ...prev, loading: false }));
      return match;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error fetching match'
      }));
      console.error('Error fetching match:', error);
      return null;
    }
  }, []);

  // Get compatibility insights for a match
  const getCompatibilityInsight = useCallback(async (matchId: string): Promise<CompatibilityInsight | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const insight = await matchesApi.getCompatibilityInsight(matchId);
      setState(prev => ({ ...prev, loading: false }));
      return insight;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error fetching compatibility insight'
      }));
      console.error('Error fetching compatibility insight:', error);
      return null;
    }
  }, []);

  // Like or unlike a match
  const updateLikeStatus = useCallback(async (matchId: string, liked: boolean): Promise<Match | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const updatedMatch = await matchesApi.updateLikeStatus(matchId, liked);

      // Update the match in the local state if it exists
      setState(prev => {
        const updatedMatches = prev.matches.map(match =>
          match.id === updatedMatch.id ? updatedMatch : match
        );

        return {
          ...prev,
          matches: updatedMatches,
          loading: false
        };
      });

      return updatedMatch;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error updating like status'
      }));
      console.error('Error updating like status:', error);
      return null;
    }
  }, []);

  // Search matches with filtering
  const searchMatches = useCallback(async (params: MatchFilterParams = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await matchesApi.searchMatches(params);
      setState(prev => ({
        ...prev,
        matches: response.items,
        total: response.total,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error searching matches'
      }));
      console.error('Error searching matches:', error);
    }
  }, []);

  // Reset matches state
  const resetMatches = useCallback(() => {
    setState(initialState);
  }, []);

  // Actions object for the hook
  const actions: MatchesActions = {
    getMatches,
    getMatch,
    getCompatibilityInsight,
    updateLikeStatus,
    searchMatches,
    resetMatches
  };

  return [state, actions];
};

export default useMatches;
