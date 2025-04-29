/**
 * Match types for the Perfect Match application
 * Defines interfaces for matches compatibility insights and match filtering
 */

import { Profile } from '../profile/types';

/**
 * Compatibility strength levels for matching
 */
export enum CompatibilityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH'
}

/**
 * Status of a match between users
 */
export enum MatchStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

/**
 * Compatibility factor representing one aspect of compatibility
 */
export interface CompatibilityFactor {
  name: string;
  description: string;
  score: number;
  category: string;
}

/**
 * Premium insights for compatibility
 */
export interface PremiumInsights {
  conversationStarters: string[];
  potentialChallenges: string[];
  valueAlignmentDetails: string;
}

/**
 * Detailed insights for compatibility
 */
export interface InsightDetails {
  summary: string;
  detailedAnalysis: string;
  keyFactors: CompatibilityFactor[];
  premiumInsights: PremiumInsights;
}

/**
 * Compatibility insight representing a specific aspect where users match
 */
export interface CompatibilityInsight {
  id: string;
  title: string;
  description: string;
  strength: CompatibilityLevel;
  category: string;
  matchId: string;
  insights: InsightDetails;
  createdAt: string;
  updatedAt: string;
}

/**
 * Match between two users
 */
export interface Match {
  id: string;
  userId: string;
  matchedUserId: string;
  matchedProfile: Profile;
  status: MatchStatus;
  compatibilityScore: number;
  compatibilityInsights: CompatibilityInsight[];
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
  lastInteractionAt: string;
  isNew: boolean;
  userAction?: 'LIKED' | 'PASSED';
  matchedUserAction?: 'LIKED' | 'PASSED';
  user1Liked?: boolean;
  user2Liked?: boolean;
}

/**
 * Paginated response for match listings
 */
export interface PaginatedMatches {
  items: Match[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Parameters for filtering matches
 */
export interface MatchFilterParams {
  status?: MatchStatus;
  minScore?: number;
  maxScore?: number;
  sortBy?: 'compatibilityScore' | 'lastInteractionAt' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  ageMin?: number;
  ageMax?: number;
  relationshipGoals?: string[];
  distance?: number;
}

/**
 * Match action request
 */
export interface MatchActionRequest {
  matchId: string;
  action: 'LIKE' | 'PASS';
}

/**
 * Match action response
 */
export interface MatchActionResponse {
  match: Match;
  mutualMatch: boolean;
  conversationId?: string;
}
