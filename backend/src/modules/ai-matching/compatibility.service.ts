import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompatibilityInsight } from './schemas/compatibility-insight.schema';
import { Match, MatchStatus } from './schemas/match.schema';
import { AiService, CompatibilityAnalysis } from './ai.service';
import { VectorService } from './vector.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CompatibilityService {
  private readonly logger = new Logger(CompatibilityService.name);

  constructor(
    @InjectModel(Match.name) private matchModel: Model<Match>,
    @InjectModel(CompatibilityInsight.name) private insightModel: Model<CompatibilityInsight>,
    private readonly aiService: AiService,
    private readonly vectorService: VectorService,
  ) {}

  /**
   * Find or create a match between two users
   */
  async findOrCreateMatch(userId1: string, userId2: string): Promise<Match> {
    // Always ensure userId1 is alphabetically smaller than userId2 for consistency
    const [smallerId, largerId] = userId1 < userId2 
      ? [userId1, userId2] 
      : [userId2, userId1];
    
    // Check if match already exists
    let match = await this.matchModel.findOne({
      userId1: smallerId,
      userId2: largerId,
    }).exec();
    
    if (match) {
      return match;
    }
    
    // Create a new match if not exists
    const matchId = uuidv4();
    
    match = new this.matchModel({
      matchId,
      userId1: smallerId,
      userId2: largerId,
      status: MatchStatus.PENDING,
      compatibilityScore: 0, // Will be calculated later
      lastActivityAt: new Date(),
    });
    
    await match.save();
    return match;
  }

  /**
   * Calculate compatibility between two users and store the result
   */
  async calculateAndStoreCompatibility(userId1: string, userId2: string): Promise<CompatibilityInsight> {
    // Find or create the match
    const match = await this.findOrCreateMatch(userId1, userId2);
    
    // Check if compatibility insight already exists
    let insight = await this.insightModel.findOne({ matchId: match.matchId }).exec();
    
    if (insight) {
      return insight;
    }
    
    // Calculate vector similarity (placeholder, actual implementation would use real vectors)
    const vectorSimilarityScore = Math.random() * 0.5 + 0.3; // Between 0.3 and 0.8
    
    // Use AI service to calculate compatibility
    const analysis = await this.aiService.analyzeCompatibility(
      match.userId1,
      match.userId2,
      vectorSimilarityScore,
    );
    
    // Create compatibility insight
    insight = new this.insightModel({
      matchId: match.matchId,
      userId1: match.userId1,
      userId2: match.userId2,
      compatibilityScore: analysis.compatibilityScore,
      generatedAt: new Date(),
      insights: {
        summary: analysis.summary,
        keyFactors: analysis.compatibilityFactors,
        detailedAnalysis: analysis.detailedAnalysis,
        premiumInsights: {
          conversationStarters: analysis.conversationStarters,
          potentialChallenges: analysis.potentialChallenges,
          valueAlignmentDetails: analysis.valueAlignmentDetails || '',
          communicationPatternAnalysis: analysis.communicationPatternAnalysis || '',
        },
      },
      aiModel: analysis.aiModel,
      vectorSimilarityScore,
      matchingVersion: '1.0',
      metadata: {
        processingTimeMs: analysis.processingTimeMs,
        questionCountUser1: 0, // Would be filled in with actual counts
        questionCountUser2: 0, // Would be filled in with actual counts
        dataSources: ['profile', 'questionnaire'],
      },
    });
    
    await insight.save();
    
    // Update match with compatibility score
    await this.matchModel.updateOne(
      { matchId: match.matchId },
      { 
        compatibilityScore: analysis.compatibilityScore,
        vectorSimilarityScore,
        aiModel: analysis.aiModel,
        matchingVersion: '1.0',
      }
    );
    
    return insight;
  }

  /**
   * Get compatibility insight for a match
   */
  async getCompatibilityInsight(matchId: string): Promise<CompatibilityInsight | null> {
    return this.insightModel.findOne({ matchId }).exec();
  }

  /**
   * Get matches for a user
   */
  async getUserMatches(userId: string, options: { 
    limit?: number; 
    offset?: number; 
    status?: MatchStatus;
    minScore?: number;
  } = {}): Promise<Match[]> {
    const { limit = 10, offset = 0, status, minScore = 0 } = options;
    
    const query: any = {
      $or: [
        { userId1: userId },
        { userId2: userId }
      ],
      compatibilityScore: { $gte: minScore }
    };
    
    if (status) {
      query.status = status;
    }
    
    return this.matchModel.find(query)
      .sort({ compatibilityScore: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /**
   * Update match status (like, dislike)
   */
  async updateMatchStatus(matchId: string, userId: string, liked: boolean): Promise<Match | null> {
    const match = await this.matchModel.findOne({ matchId }).exec();
    
    if (!match) {
      return null;
    }
    
    // Update the appropriate field based on which user is updating
    if (match.userId1 === userId) {
      match.user1Liked = liked;
    } else if (match.userId2 === userId) {
      match.user2Liked = liked;
    } else {
      throw new Error('User is not part of this match');
    }
    
    // Update match status based on likes
    if (match.user1Liked && match.user2Liked) {
      match.status = MatchStatus.ACTIVE;
    } else if (!match.user1Liked || !match.user2Liked) {
      // Only set to REJECTED if explicitly disliked
      if ((match.userId1 === userId && !liked) || (match.userId2 === userId && !liked)) {
        match.status = MatchStatus.REJECTED;
      }
    }
    
    match.lastActivityAt = new Date();
    await match.save();
    
    return match;
  }

  /**
   * Search for matches with filtering
   */
  async searchMatches(userId: string, params: {
    minScore?: number;
    maxDistance?: number;
    ageRange?: [number, number];
    genders?: string[];
    relationshipGoals?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Match[]> {
    // This would typically include more complex filtering logic with geospatial queries
    // and joining with user profile data for demographic filtering
    
    const { 
      minScore = 70, 
      limit = 10, 
      offset = 0
    } = params;
    
    return this.matchModel.find({
      $or: [{ userId1: userId }, { userId2: userId }],
      status: MatchStatus.PENDING,
      compatibilityScore: { $gte: minScore },
    })
    .sort({ compatibilityScore: -1 })
    .skip(offset)
    .limit(limit)
    .exec();
  }
}
