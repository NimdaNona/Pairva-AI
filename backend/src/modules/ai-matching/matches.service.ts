import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Match, MatchStatus } from './schemas/match.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectModel(Match.name) private matchModel: Model<Match>
  ) {}

  /**
   * Find a match by ID
   */
  async findMatchById(matchId: string): Promise<Match | null> {
    return this.matchModel.findOne({ matchId }).exec();
  }

  /**
   * Create a new match between two users
   */
  async createMatch(userId1: string, userId2: string): Promise<Match> {
    // Always ensure userId1 is alphabetically smaller than userId2 for consistency
    const [smallerId, largerId] = userId1 < userId2
      ? [userId1, userId2]
      : [userId2, userId1];

    const matchId = uuidv4();

    const match = new this.matchModel({
      matchId,
      userId1: smallerId,
      userId2: largerId,
      status: MatchStatus.PENDING,
      compatibilityScore: 0,
      user1Liked: false,
      user2Liked: false,
      lastActivityAt: new Date(),
      createdAt: new Date()
    });

    await match.save();
    return match;
  }

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
      userId2: largerId
    }).exec();

    if (match) {
      return match;
    }

    // Create new match if not exists
    return this.createMatch(smallerId, largerId);
  }

  /**
   * Get all matches for a user
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
   * Update like status for a match
   */
  async updateLikeStatus(matchId: string, userId: string, liked: boolean): Promise<Match | null> {
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
    } else if (match.user1Liked === false || match.user2Liked === false) {
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
   * Count total matches for a user
   */
  async countUserMatches(userId: string, status?: MatchStatus): Promise<number> {
    const query: any = {
      $or: [
        { userId1: userId },
        { userId2: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    return this.matchModel.countDocuments(query).exec();
  }

  /**
   * Get mutual matches (both users liked each other)
   */
  async getMutualMatches(userId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<Match[]> {
    const { limit = 10, offset = 0 } = options;

    return this.matchModel.find({
      $or: [
        { userId1: userId },
        { userId2: userId }
      ],
      status: MatchStatus.ACTIVE,
      user1Liked: true,
      user2Liked: true
    })
    .sort({ lastActivityAt: -1 })
    .skip(offset)
    .limit(limit)
    .exec();
  }

  /**
   * Get matches awaiting user's response
   */
  async getPendingMatches(userId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<Match[]> {
    const { limit = 10, offset = 0 } = options;

    return this.matchModel.find({
      $or: [
        { userId1: userId, user1Liked: null },
        { userId2: userId, user2Liked: null }
      ],
      status: MatchStatus.PENDING
    })
    .sort({ compatibilityScore: -1 })
    .skip(offset)
    .limit(limit)
    .exec();
  }

  /**
   * Delete a match by ID
   */
  async deleteMatch(matchId: string): Promise<boolean> {
    const result = await this.matchModel.deleteOne({ matchId }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Update compatibility score for a match
   */
  async updateCompatibilityScore(matchId: string, score: number): Promise<Match | null> {
    const match = await this.matchModel.findOneAndUpdate(
      { matchId },
      { compatibilityScore: score },
      { new: true }
    ).exec();

    return match;
  }
}
