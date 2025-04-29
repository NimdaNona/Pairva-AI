import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { catchError, firstValueFrom, retry, timeout } from 'rxjs';
import { ProfilesService } from '../profiles/profiles.service';
import { CompatibilityFactor, PremiumInsights } from './schemas/compatibility-insight.schema';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CompatibilityAnalysis {
  compatibilityScore: number;
  compatibilityFactors: CompatibilityFactor[];
  summary: string;
  detailedAnalysis: string;
  conversationStarters: string[];
  potentialChallenges: string[];
  valueAlignmentDetails?: string;
  communicationPatternAnalysis?: string;
  aiModel: string;
  processingTimeMs: number;
}

export interface UserMatchProfile {
  userId: string;
  profileSummary: {
    age: number;
    gender: string;
    location: string;
    relationshipGoal: string;
    keyTraits: string[];
    values: string[];
  };
  questionnaireData: Record<string, any>;
}

export interface AIModelConfig {
  primaryModel: string;
  fallbackModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
  enabled: boolean;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private openAiApiKey: string;
  private modelConfig: AIModelConfig;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly profilesService: ProfilesService,
    private readonly questionnaireService: QuestionnaireService
  ) {
    this.modelConfig = {
      primaryModel: this.configService.get<string>('OPENAI_MODEL', 'gpt-4.1'),
      fallbackModel: 'gpt-4',
      requestTimeoutMs: 30000,
      maxRetries: 3,
      enabled: true
    };
  }

  async onModuleInit() {
    // Get OpenAI API key from environment variables or secret storage
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY', 'sk-proj-bcdlqD6K0ZErnmYwjXnejgJLr2GCWXzfz3qh3qcYNpR4_yJUzlXoLe7c1rIItE9LxPoNyXIW-PQT3BlbkFJplWHX59YHfNyf5i6u1ogFY60qiGLhYKhI9nR0mdTvOqTfiGVF750y-qy0ZyeXw2_9eYMEjJfEA');

    if (!this.openAiApiKey) {
      this.logger.warn('OpenAI API key not found. AI matching service will use fallback methods.');
      this.modelConfig.enabled = false;
    } else {
      this.logger.log(`AI matching service initialized with model: ${this.modelConfig.primaryModel}`);
    }
  }

  /**
   * Analyze compatibility between two users
   */
  async analyzeCompatibility(
    userId1: string,
    userId2: string,
    vectorSimilarityScore: number
  ): Promise<CompatibilityAnalysis> {
    // Start timing the process
    const startTime = Date.now();

    try {
      // Get user profiles and questionnaire data
      const [user1Profile, user2Profile] = await Promise.all([
        this.getUserMatchProfile(userId1),
        this.getUserMatchProfile(userId2)
      ]);

      // Calculate vector similarity scores for different dimensions
      const similarityScores = await this.calculateSimilarityScores(user1Profile, user2Profile);

      // Generate compatibility analysis
      if (this.modelConfig.enabled && this.openAiApiKey) {
        const analysis = await this.generateAICompatibilityAnalysis(
          user1Profile,
          user2Profile,
          similarityScores,
          vectorSimilarityScore
        );

        // Calculate processing time
        const processingTime = Date.now() - startTime;
        return {
          ...analysis,
          aiModel: this.modelConfig.primaryModel,
          processingTimeMs: processingTime
        };
      } else {
        // Use fallback vector-based scoring if AI is unavailable
        return this.generateVectorBasedCompatibility(
          user1Profile,
          user2Profile,
          similarityScores,
          vectorSimilarityScore,
          startTime
        );
      }
    } catch (error) {
      this.logger.error(`Error analyzing compatibility: ${error.message}`, error.stack);

      // Fallback to vector-based scoring in case of error
      const fallbackStartTime = Date.now();
      const user1Profile = await this.getUserMatchProfile(userId1);
      const user2Profile = await this.getUserMatchProfile(userId2);
      const similarityScores = await this.calculateSimilarityScores(user1Profile, user2Profile);

      return this.generateVectorBasedCompatibility(
        user1Profile,
        user2Profile,
        similarityScores,
        vectorSimilarityScore,
        fallbackStartTime
      );
    }
  }

  /**
   * Get user profile and questionnaire data formatted for matching
   */
  private async getUserMatchProfile(userId: string): Promise<UserMatchProfile> {
    // Get profile data
    const profile = await this.profilesService.findByUserId(userId);

    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    // Get questionnaire responses - Using the main/standard questionnaire ID
    // Fixed: Added questionnaireId parameter to getUserResponse call
    const mainQuestionnaireId = this.configService.get<string>('MAIN_QUESTIONNAIRE_ID', '000000000000000000000001');
    const responses = await this.questionnaireService.getUserResponse(userId, mainQuestionnaireId);

    // Format profile summary
    const profileSummary = {
      age: this.calculateAge(profile.birthDate),
      gender: profile.gender,
      location: profile.location,
      relationshipGoal: profile.relationshipGoal,
      keyTraits: profile.attributes?.personality || [],
      values: profile.attributes?.values || []
    };

    // Extract and organize questionnaire data
    // Fixed: Added proper handling of null/undefined responses
    const questionnaireData = responses ? this.organizeQuestionnaireData(Array.isArray(responses) ? responses : [responses]) : {};

    return {
      userId,
      profileSummary,
      questionnaireData
    };
  }

  /**
   * Calculate age from birth date
   */
  private calculateAge(birthDate: Date | string): number {
    if (!birthDate) return 0;

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Organize questionnaire responses into structured format
   */
  private organizeQuestionnaireData(responses: any[]): Record<string, any> {
    // Handle case where responses might be invalid or empty
    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return {
        relationshipGoals: {},
        communicationStyle: {},
        values: {},
        lifestyleFactors: {},
        interestsAndHobbies: {}
      };
    }

    // Create organized data structure from responses
    const organizedData: Record<string, any> = {
      relationshipGoals: {},
      communicationStyle: {},
      values: {},
      lifestyleFactors: {},
      interestsAndHobbies: {}
    };

    // Process responses and organize by category
    for (const response of responses) {
      // Skip if no question metadata or no valid response object
      if (!response || !response.question?.metadata?.category) continue;

      const category = response.question.metadata.category;
      const factor = response.question.metadata.compatibilityFactor;
      const importance = response.question.metadata.aiMatchingWeight || 5;

      // Add to appropriate category
      if (!organizedData[category]) {
        organizedData[category] = {};
      }

      if (factor) {
        organizedData[category][factor] = response.answer;
      }

      // Track importance at category level
      if (!organizedData[category].importance) {
        organizedData[category].importance = importance;
      } else {
        // Average importance across factors in same category
        const current = organizedData[category].importance;
        organizedData[category].importance = (current + importance) / 2;
      }
    }

    return organizedData;
  }

  /**
   * Calculate similarity scores for different dimensions
   */
  private async calculateSimilarityScores(
    user1: UserMatchProfile,
    user2: UserMatchProfile
  ): Promise<Record<string, number>> {
    // This would typically use vector embeddings comparison
    // For now we'll use a simplified approach

    return {
      valuesSimilarity: 0.82, // Placeholder
      communicationStyleSimilarity: 0.75, // Placeholder
      relationshipExpectationsSimilarity: 0.91, // Placeholder
      personalityTraitsSimilarity: 0.68, // Placeholder
      interestsSimilarity: 0.79, // Placeholder
    };
  }

  /**
   * Generate AI-based compatibility analysis
   */
  private async generateAICompatibilityAnalysis(
    user1: UserMatchProfile,
    user2: UserMatchProfile,
    similarityScores: Record<string, number>,
    vectorSimilarityScore: number
  ): Promise<CompatibilityAnalysis> {
    // Build the prompt for the AI model
    const prompt = this.buildPrompt(user1, user2, similarityScores, vectorSimilarityScore);

    // Call OpenAI API
    const aiResponse = await this.callOpenAI(prompt);

    // Parse and structure the response
    return this.parseAIResponse(aiResponse);
  }

  /**
   * Build a prompt for the AI model
   */
  private buildPrompt(
    user1: UserMatchProfile,
    user2: UserMatchProfile,
    similarityScores: Record<string, number>,
    vectorSimilarityScore: number
  ): string {
    return `
System: You are a relationship compatibility analyst for a matchmaking application. Based on the questionnaire responses of two users analyze their compatibility and generate insights.

User: I need to analyze the compatibility between User A and User B.

User A Profile Summary:
- Age: ${user1.profileSummary.age}
- Gender: ${user1.profileSummary.gender}
- Location: ${user1.profileSummary.location}
- Relationship Goal: ${user1.profileSummary.relationshipGoal}
- Key Traits: ${user1.profileSummary.keyTraits.join(' ')}
- Values: ${user1.profileSummary.values.join(' ')}

User A Questionnaire Data:
${JSON.stringify(user1.questionnaireData, null, 2)}

User B Profile Summary:
- Age: ${user2.profileSummary.age}
- Gender: ${user2.profileSummary.gender}
- Location: ${user2.profileSummary.location}
- Relationship Goal: ${user2.profileSummary.relationshipGoal}
- Key Traits: ${user2.profileSummary.keyTraits.join(' ')}
- Values: ${user2.profileSummary.values.join(' ')}

User B Questionnaire Data:
${JSON.stringify(user2.questionnaireData, null, 2)}

Vector similarity scores:
- Values similarity: ${similarityScores.valuesSimilarity}
- Communication style similarity: ${similarityScores.communicationStyleSimilarity}
- Relationship expectations similarity: ${similarityScores.relationshipExpectationsSimilarity}
- Personality traits similarity: ${similarityScores.personalityTraitsSimilarity}
- Interests similarity: ${similarityScores.interestsSimilarity}
- Overall vector similarity: ${vectorSimilarityScore}

Provide a detailed compatibility analysis including:
1. Overall compatibility score (0-100)
2. 5-7 key compatibility factors with individual scores
3. Brief summary of compatibility strengths (1-2 sentences)
4. Detailed explanation of compatibility strengths and potential challenges
5. 3-5 conversation starter suggestions based on shared interests or values
6. 2-3 potential relationship challenges that may need attention

Format your response as JSON with the following structure:
{
  "compatibilityScore": number,
  "compatibilityFactors": [
    {"name": string, "score": number, "description": string}
  ],
  "summary": string,
  "detailedAnalysis": string,
  "conversationStarters": [string],
  "potentialChallenges": [string],
  "valueAlignmentDetails": string,
  "communicationPatternAnalysis": string
}
`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<OpenAIResponse> {
    const payload = {
      model: this.modelConfig.primaryModel,
      messages: [
        { role: 'system', content: 'You are a relationship compatibility analyst for a matchmaking application.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    };

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openAiApiKey}`
      }
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/chat/completions`, payload, config).pipe(
          timeout(this.modelConfig.requestTimeoutMs),
          retry({
            count: this.modelConfig.maxRetries,
            delay: 1000,
            resetOnSuccess: true
          }),
          catchError((error: AxiosError) => {
            this.logger.error(`OpenAI API error: ${error.message}`, error.stack);
            throw error;
          })
        )
      );

      return response.data;
    } catch (error) {
      // Try fallback model if primary fails
      if (this.modelConfig.primaryModel !== this.modelConfig.fallbackModel) {
        this.logger.warn(`Primary model failed, trying fallback model: ${this.modelConfig.fallbackModel}`);

        payload.model = this.modelConfig.fallbackModel;

        try {
          const fallbackResponse = await firstValueFrom(
            this.httpService.post(`${this.baseUrl}/chat/completions`, payload, config).pipe(
              timeout(this.modelConfig.requestTimeoutMs),
              retry({ count: 2, delay: 1000 }),
              catchError((error: AxiosError) => {
                this.logger.error(`Fallback OpenAI API error: ${error.message}`, error.stack);
                throw error;
              })
            )
          );

          return fallbackResponse.data;
        } catch (fallbackError) {
          this.logger.error('Both primary and fallback models failed', fallbackError);
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Parse and structure OpenAI API response
   */
  private parseAIResponse(response: OpenAIResponse): CompatibilityAnalysis {
    try {
      const content = response.choices[0].message.content;
      const data = JSON.parse(content);

      return {
        compatibilityScore: data.compatibilityScore,
        compatibilityFactors: data.compatibilityFactors,
        summary: data.summary,
        detailedAnalysis: data.detailedAnalysis,
        conversationStarters: data.conversationStarters,
        potentialChallenges: data.potentialChallenges,
        valueAlignmentDetails: data.valueAlignmentDetails,
        communicationPatternAnalysis: data.communicationPatternAnalysis,
        aiModel: response.model,
        processingTimeMs: 0 // Will be filled by caller
      };
    } catch (error) {
      this.logger.error(`Error parsing AI response: ${error.message}`, error.stack);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Generate compatibility analysis using vector similarity as fallback
   */
  private generateVectorBasedCompatibility(
    user1: UserMatchProfile,
    user2: UserMatchProfile,
    similarityScores: Record<string, number>,
    vectorSimilarityScore: number,
    startTime: number
  ): CompatibilityAnalysis {
    // Convert vector score (0-1) to compatibility percentage (0-100)
    const score = Math.round(vectorSimilarityScore * 100);

    // Generate factors based on similarity dimensions
    const factors: CompatibilityFactor[] = [
      {
        name: 'Values Alignment',
        score: Math.round(similarityScores.valuesSimilarity * 100),
        description: 'How well your core values and beliefs align.',
        category: 'values'
      },
      {
        name: 'Communication Style',
        score: Math.round(similarityScores.communicationStyleSimilarity * 100),
        description: 'Compatibility in how you both express and receive information.',
        category: 'communication'
      },
      {
        name: 'Relationship Expectations',
        score: Math.round(similarityScores.relationshipExpectationsSimilarity * 100),
        description: 'Alignment in what you both want from a relationship.',
        category: 'expectations'
      },
      {
        name: 'Personality Compatibility',
        score: Math.round(similarityScores.personalityTraitsSimilarity * 100),
        description: 'How well your personality traits complement each other.',
        category: 'personality'
      },
      {
        name: 'Shared Interests',
        score: Math.round(similarityScores.interestsSimilarity * 100),
        description: 'Common activities and topics you both enjoy.',
        category: 'interests'
      }
    ];

    // Generate generic summary based on overall score
    let summary = '';
    if (score >= 85) {
      summary = 'You have exceptional compatibility across multiple dimensions suggesting a strong potential connection.';
    } else if (score >= 70) {
      summary = 'You share good compatibility in key areas with complementary traits that could form a balanced relationship.';
    } else if (score >= 50) {
      summary = 'You have moderate compatibility with some strong connection points and areas that may require compromise.';
    } else {
      summary = 'Your compatibility shows some challenges though differences can sometimes create growth opportunities.';
    }

    // Generate generic conversation starters
    const starters = [
      `You both mentioned interest in ${user1.profileSummary.keyTraits.slice(0, 1).join(' ')}. What aspects do you enjoy most?`,
      `Your profiles suggest you might share views on ${user2.profileSummary.values.slice(0, 1).join(' ')}. What's your perspective?`,
      `You appear to have similar approach to ${Object.keys(user1.questionnaireData)[0]}. How important is this to you?`
    ];

    // Generate generic challenges
    const challenges = [
      'You may have different communication preferences that could require adjustment and understanding.',
      'Your differing perspectives on certain values might require respectful discussion and compromise.'
    ];

    const processingTime = Date.now() - startTime;

    return {
      compatibilityScore: score,
      compatibilityFactors: factors,
      summary,
      detailedAnalysis: 'Compatibility analysis based on profile similarity metrics. For more detailed insights please check back later when AI analysis is available.',
      conversationStarters: starters,
      potentialChallenges: challenges,
      valueAlignmentDetails: 'Detailed value alignment analysis not available in fallback mode.',
      communicationPatternAnalysis: 'Communication pattern analysis not available in fallback mode.',
      aiModel: 'vector-similarity-fallback',
      processingTimeMs: processingTime
    };
  }
}
