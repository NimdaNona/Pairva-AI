import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

/**
 * Service for vector-based operations for matching algorithm
 */
@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);

  constructor(
    private configService: ConfigService,
  ) {}

  /**
   * Calculate cosine similarity between two vectors
   * @param vectorA First vector
   * @param vectorB Second vector
   * @returns Cosine similarity score (0-1)
   */
  calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      this.logger.warn(`Vector dimensions don't match: ${vectorA.length} vs ${vectorB.length}`);
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] ** 2;
      normB += vectorB[i] ** 2;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate similarity scores between users by profile dimension
   * @param userId1 First user ID
   * @param userId2 Second user ID
   * @returns Similarity scores by dimension
   */
  async calculateProfileSimilarity(
    profile1Data: any,
    profile2Data: any,
  ): Promise<Record<string, number>> {
    // In a real implementation, this would use trained embeddings
    // For now, using simplified placeholder implementation
    
    const dimensions = {
      values: this.calculateDimensionSimilarity(profile1Data.values, profile2Data.values),
      personality: this.calculateDimensionSimilarity(profile1Data.personality, profile2Data.personality),
      interests: this.calculateDimensionSimilarity(profile1Data.interests, profile2Data.interests),
      goals: this.calculateDimensionSimilarity(profile1Data.goals, profile2Data.goals),
      communication: this.calculateDimensionSimilarity(profile1Data.communication, profile2Data.communication),
    };

    // Calculate overall score as weighted average
    const weights = {
      values: 0.25,
      personality: 0.20,
      interests: 0.15,
      goals: 0.25,
      communication: 0.15,
    };

    let overallScore = 0;
    let totalWeight = 0;

    for (const [dimension, score] of Object.entries(dimensions)) {
      const weight = weights[dimension as keyof typeof weights] || 0;
      overallScore += score * weight;
      totalWeight += weight;
    }

    const normalizedScore = totalWeight > 0 ? overallScore / totalWeight : 0;

    return {
      valuesSimilarity: dimensions.values,
      personalityTraitsSimilarity: dimensions.personality,
      interestsSimilarity: dimensions.interests,
      relationshipExpectationsSimilarity: dimensions.goals,
      communicationStyleSimilarity: dimensions.communication,
      overallSimilarity: normalizedScore,
    };
  }

  /**
   * Calculate similarity for a single dimension
   */
  private calculateDimensionSimilarity(values1: any, values2: any): number {
    // Handle arrays (e.g., interests, values)
    if (Array.isArray(values1) && Array.isArray(values2)) {
      if (values1.length === 0 || values2.length === 0) return 0;
      
      const set1 = new Set(values1);
      const set2 = new Set(values2);
      
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      return intersection.size / union.size; // Jaccard similarity
    }
    
    // Handle numeric values (e.g., age preferences)
    if (typeof values1 === 'number' && typeof values2 === 'number') {
      const max = Math.max(values1, values2);
      const min = Math.min(values1, values2);
      
      return min / max; // Simple ratio similarity
    }
    
    // Handle string values (e.g., relationship goals)
    if (typeof values1 === 'string' && typeof values2 === 'string') {
      return values1 === values2 ? 1.0 : 0.0; // Exact match or no match
    }
    
    // Handle objects recursively
    if (typeof values1 === 'object' && typeof values2 === 'object' && 
        values1 !== null && values2 !== null && 
        !Array.isArray(values1) && !Array.isArray(values2)) {
      const keys1 = Object.keys(values1);
      const keys2 = Object.keys(values2);
      
      // Find common keys
      const commonKeys = keys1.filter(key => keys2.includes(key));
      
      if (commonKeys.length === 0) return 0;
      
      // Calculate similarity for each common key
      let totalSimilarity = 0;
      
      for (const key of commonKeys) {
        totalSimilarity += this.calculateDimensionSimilarity(values1[key], values2[key]);
      }
      
      return totalSimilarity / commonKeys.length;
    }
    
    // Default case
    return 0;
  }
}
