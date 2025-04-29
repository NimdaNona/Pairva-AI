import axios from 'axios';
import { getAuthHeader } from '../auth/authUtils';
import { Match, MatchStatus, CompatibilityInsight, PaginatedMatches, MatchFilterParams, MatchActionRequest } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * API interface for managing matches
 */
const matchesApi = {
  /**
   * Get all matches for the current user
   */
  async getMatches(
    options: {
      limit?: number;
      page?: number;
      status?: MatchStatus;
      minScore?: number;
    } = {}
  ): Promise<PaginatedMatches> {
    const { limit = 10, page = 1, status, minScore } = options;

    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('page', page.toString());

    if (status) {
      params.append('status', status);
    }

    if (minScore !== undefined) {
      params.append('minScore', minScore.toString());
    }

    const response = await axios.get(`${API_BASE_URL}/matches?${params.toString()}`, {
      headers: await getAuthHeader()
    });

    return response.data;
  },

  /**
   * Get a specific match by ID
   */
  async getMatch(matchId: string): Promise<Match> {
    const response = await axios.get(`${API_BASE_URL}/matches/${matchId}`, {
      headers: await getAuthHeader()
    });

    return response.data;
  },

  /**
   * Get compatibility insights for a match
   */
  async getCompatibilityInsight(matchId: string): Promise<CompatibilityInsight> {
    const response = await axios.get(`${API_BASE_URL}/matches/${matchId}/compatibility`, {
      headers: await getAuthHeader()
    });

    return response.data;
  },

  /**
   * Like or pass on a match
   */
  async updateMatchAction(matchId: string, action: 'LIKE' | 'PASS'): Promise<Match> {
    const response = await axios.put(
      `${API_BASE_URL}/matches/${matchId}/action`,
      { action },
      {
        headers: await getAuthHeader()
      }
    );

    return response.data;
  },

  /**
   * Update the like status of a match
   */
  async updateLikeStatus(matchId: string, liked: boolean): Promise<Match> {
    const action = liked ? 'LIKE' : 'PASS';
    return this.updateMatchAction(matchId, action);
  },

  /**
   * Search matches with filtering
   */
  async searchMatches(params: MatchFilterParams = {}): Promise<PaginatedMatches> {
    const {
      minScore = 70,
      maxScore,
      sortBy = 'compatibilityScore',
      sortDirection = 'desc',
      status,
      page = 1,
      limit = 10
    } = params;

    const queryParams = new URLSearchParams();
    queryParams.append('minScore', minScore.toString());
    if (maxScore !== undefined) {
      queryParams.append('maxScore', maxScore.toString());
    }
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortDirection', sortDirection);
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());

    if (status) {
      queryParams.append('status', status);
    }

    const response = await axios.get(`${API_BASE_URL}/matches/search?${queryParams.toString()}`, {
      headers: await getAuthHeader()
    });

    return response.data;
  }
};

export default matchesApi;
export type { Match, MatchStatus, CompatibilityInsight, PaginatedMatches, MatchFilterParams, MatchActionRequest };
