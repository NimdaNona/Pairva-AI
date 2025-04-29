import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompatibilityService } from './compatibility.service';
import { MatchStatus } from './schemas/match.schema';
import { Request } from 'express';

// Extend Express Request type to include user property with JWT claims
interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    [key: string]: any;
  };
}

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);

  constructor(private readonly compatibilityService: CompatibilityService) {}

  /**
   * Get all matches for the current user
   */
  @Get()
  async getMatches(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0,
    @Query('status') status?: MatchStatus,
    @Query('minScore') minScore = 0,
  ) {
    try {
      const userId = req.user.sub;
      const matches = await this.compatibilityService.getUserMatches(userId, {
        limit: +limit,
        offset: +offset,
        status,
        minScore: +minScore,
      });

      return {
        matches,
        total: matches.length,
        limit: +limit,
        offset: +offset,
      };
    } catch (error) {
      this.logger.error(`Error getting matches: ${error.message}`, error.stack);
      throw new HttpException('Failed to get matches', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a specific match by ID
   */
  @Get(':matchId')
  async getMatch(@Req() req: AuthenticatedRequest, @Param('matchId') matchId: string) {
    try {
      const userId = req.user.sub;
      const match = await this.compatibilityService.findOrCreateMatch(userId, matchId);
      
      if (!match) {
        throw new HttpException('Match not found', HttpStatus.NOT_FOUND);
      }
      
      // Ensure user is part of this match
      if (match.userId1 !== userId && match.userId2 !== userId) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }
      
      return match;
    } catch (error) {
      this.logger.error(`Error getting match: ${error.message}`, error.stack);
      throw new HttpException('Failed to get match', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get compatibility insights for a match
   */
  @Get(':matchId/compatibility')
  async getCompatibilityInsight(@Req() req: AuthenticatedRequest, @Param('matchId') matchId: string) {
    try {
      const userId = req.user.sub;
      const match = await this.compatibilityService.findOrCreateMatch(userId, matchId);
      
      if (!match) {
        throw new HttpException('Match not found', HttpStatus.NOT_FOUND);
      }
      
      // Ensure user is part of this match
      if (match.userId1 !== userId && match.userId2 !== userId) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }
      
      const insight = await this.compatibilityService.getCompatibilityInsight(match.matchId);
      
      if (!insight) {
        // Generate compatibility insight if it doesn't exist
        return this.compatibilityService.calculateAndStoreCompatibility(match.userId1, match.userId2);
      }
      
      return insight;
    } catch (error) {
      this.logger.error(`Error getting compatibility: ${error.message}`, error.stack);
      throw new HttpException('Failed to get compatibility insight', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Like or unlike a match
   */
  @Put(':matchId/like')
  async likeMatch(
    @Req() req: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Body() body: { liked: boolean },
  ) {
    try {
      const userId = req.user.sub;
      const { liked } = body;
      
      const match = await this.compatibilityService.updateMatchStatus(matchId, userId, liked);
      
      if (!match) {
        throw new HttpException('Match not found', HttpStatus.NOT_FOUND);
      }
      
      return match;
    } catch (error) {
      this.logger.error(`Error updating match status: ${error.message}`, error.stack);
      throw new HttpException('Failed to update match status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Search for matches with filtering
   */
  @Get('search')
  async searchMatches(
    @Req() req: AuthenticatedRequest,
    @Query('minScore') minScore = 70,
    @Query('maxDistance') maxDistance = 50,
    @Query('ageMin') ageMin = 18,
    @Query('ageMax') ageMax = 99,
    @Query('genders') genders?: string,
    @Query('relationshipGoals') relationshipGoals?: string,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0,
  ) {
    try {
      const userId = req.user.sub;
      
      // Parse array parameters
      const gendersArray = genders ? genders.split(',') : undefined;
      const goalsArray = relationshipGoals ? relationshipGoals.split(',') : undefined;
      
      const matches = await this.compatibilityService.searchMatches(userId, {
        minScore: +minScore,
        maxDistance: +maxDistance,
        ageRange: [+ageMin, +ageMax],
        genders: gendersArray,
        relationshipGoals: goalsArray,
        limit: +limit,
        offset: +offset,
      });
      
      return {
        matches,
        total: matches.length,
        limit: +limit,
        offset: +offset,
      };
    } catch (error) {
      this.logger.error(`Error searching matches: ${error.message}`, error.stack);
      throw new HttpException('Failed to search matches', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Trigger compatibility processing for a user pair (admin only)
   */
  @Post('process')
  async processMatch(
    @Req() req: AuthenticatedRequest,
    @Body() body: { userId1: string; userId2: string },
  ) {
    try {
      const { userId1, userId2 } = body;
      
      // In a real implementation, we'd check if user is admin
      // if (!req.user.isAdmin) {
      //   throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      // }
      
      return this.compatibilityService.calculateAndStoreCompatibility(userId1, userId2);
    } catch (error) {
      this.logger.error(`Error processing match: ${error.message}`, error.stack);
      throw new HttpException('Failed to process match', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
