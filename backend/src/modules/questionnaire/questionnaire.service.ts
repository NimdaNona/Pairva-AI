import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Questionnaire, QuestionnaireCategory, QuestionnaireStatus } from './schemas/questionnaire.schema';
import { Question, QuestionType } from './schemas/question.schema';
import { Response } from './schemas/response.schema';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Injectable()
export class QuestionnaireService {
  constructor(
    @InjectModel(Questionnaire.name)
    private readonly questionnaireModel: Model<Questionnaire>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    @InjectModel(Response.name)
    private readonly responseModel: Model<Response>,
  ) {}

  // ----- Questionnaire Management -----

  /**
   * Create a new questionnaire
   */
  async createQuestionnaire(createQuestionnaireDto: CreateQuestionnaireDto): Promise<Questionnaire> {
    const questionnaire = new this.questionnaireModel(createQuestionnaireDto);
    return questionnaire.save();
  }

  /**
   * Get all questionnaires with optional filters
   */
  async findAllQuestionnaires(
    filters?: Partial<{ category: QuestionnaireCategory; status: QuestionnaireStatus; isActive: boolean }>,
  ): Promise<Questionnaire[]> {
    return this.questionnaireModel.find({ ...filters }).sort({ order: 1 }).exec();
  }

  /**
   * Get a questionnaire by ID
   */
  async findQuestionnaireById(id: string): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireModel.findById(id).exec();
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }
    return questionnaire;
  }

  /**
   * Get a questionnaire with its questions
   */
  async findQuestionnaireWithQuestions(id: string): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireModel
      .findById(id)
      .populate('questions')
      .exec();
    
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }
    
    return questionnaire;
  }

  /**
   * Update a questionnaire
   */
  async updateQuestionnaire(
    id: string,
    updateQuestionnaireDto: UpdateQuestionnaireDto,
  ): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireModel
      .findByIdAndUpdate(id, updateQuestionnaireDto, { new: true })
      .exec();
    
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }
    
    return questionnaire;
  }

  /**
   * Delete a questionnaire
   */
  async deleteQuestionnaire(id: string): Promise<void> {
    const result = await this.questionnaireModel.findByIdAndDelete(id).exec();
    
    if (!result) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }
    
    // Delete associated questions
    await this.questionModel.deleteMany({ questionnaire: id }).exec();
    
    // Delete associated responses
    await this.responseModel.deleteMany({ questionnaireId: id }).exec();
  }

  // ----- Question Management -----

  /**
   * Create a new question for a questionnaire
   */
  async createQuestion(
    questionnaireId: string,
    createQuestionDto: CreateQuestionDto,
  ): Promise<Question> {
    // Check if questionnaire exists
    const questionnaire = await this.findQuestionnaireById(questionnaireId);
    
    // Create the question
    const question = new this.questionModel({
      ...createQuestionDto,
      questionnaire: questionnaireId,
    });
    
    const savedQuestion = await question.save();
    
    // Add question to questionnaire
    await this.questionnaireModel.findByIdAndUpdate(
      questionnaireId,
      { $push: { questions: savedQuestion._id } },
    ).exec();
    
    return savedQuestion;
  }

  /**
   * Get all questions for a questionnaire
   */
  async findQuestionsByQuestionnaire(questionnaireId: string): Promise<Question[]> {
    return this.questionModel
      .find({ questionnaire: questionnaireId, isActive: true })
      .sort({ order: 1 })
      .exec();
  }

  /**
   * Get a question by ID
   */
  async findQuestionById(id: string): Promise<Question> {
    const question = await this.questionModel.findById(id).exec();
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    
    return question;
  }

  /**
   * Update a question
   */
  async updateQuestion(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
  ): Promise<Question> {
    const question = await this.questionModel
      .findByIdAndUpdate(id, updateQuestionDto, { new: true })
      .exec();
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    
    return question;
  }

  /**
   * Delete a question
   */
  async deleteQuestion(id: string): Promise<void> {
    const question = await this.questionModel.findById(id).exec();
    
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    
    // Remove question from questionnaire
    await this.questionnaireModel.findByIdAndUpdate(
      question.questionnaire,
      { $pull: { questions: id } },
    ).exec();
    
    // Delete the question
    await this.questionModel.findByIdAndDelete(id).exec();
  }

  // ----- Response Management -----

  /**
   * Submit a response to a questionnaire
   */
  async submitResponse(
    userId: string,
    profileId: string,
    questionnaireId: string,
    submitResponseDto: SubmitResponseDto,
  ): Promise<Response | null> {
    // Check if questionnaire exists
    const questionnaire = await this.findQuestionnaireById(questionnaireId);
    
    // Check if user already has a response for this questionnaire
    const existingResponse = await this.responseModel.findOne({
      userId,
      questionnaireId,
    }).exec();
    
    if (existingResponse) {
      // Update existing response
      const updated = await this.responseModel.findByIdAndUpdate(
        existingResponse._id,
        {
          responses: submitResponseDto.responses,
          isComplete: submitResponseDto.isComplete,
          completedAt: submitResponseDto.isComplete ? new Date() : undefined,
          metadata: submitResponseDto.metadata,
        },
        { new: true },
      ).exec();
      
      return updated;
    } else {
      // Create new response
      const response = new this.responseModel({
        userId,
        profileId,
        questionnaireId,
        responses: submitResponseDto.responses,
        isComplete: submitResponseDto.isComplete,
        completedAt: submitResponseDto.isComplete ? new Date() : undefined,
        metadata: submitResponseDto.metadata,
        matchingData: {
          processedForMatching: false,
        },
      });
      
      return response.save();
    }
  }

  /**
   * Get user's response to a questionnaire
   */
  async getUserResponse(
    userId: string,
    questionnaireId: string,
  ): Promise<Response | null> {
    const response = await this.responseModel
      .findOne({ userId, questionnaireId })
      .exec();
    
    if (!response) {
      return null; // Return null if no response exists
    }
    
    return response;
  }

  /**
   * Get all responses for a questionnaire
   */
  async getQuestionnaireResponses(questionnaireId: string): Promise<Response[]> {
    return this.responseModel
      .find({ questionnaireId, isComplete: true })
      .exec();
  }

  // ----- Analytics -----

  /**
   * Get completion rate for a questionnaire
   */
  async getCompletionRate(questionnaireId: string): Promise<number> {
    const totalResponses = await this.responseModel.countDocuments({
      questionnaireId,
    });
    
    const completedResponses = await this.responseModel.countDocuments({
      questionnaireId,
      isComplete: true,
    });
    
    if (totalResponses === 0) {
      return 0;
    }
    
    return (completedResponses / totalResponses) * 100;
  }

  /**
   * Get response statistics for a question
   */
  async getQuestionStats(questionId: string): Promise<any> {
    const question = await this.findQuestionById(questionId);
    
    // Get all responses for the questionnaire that contains this question
    const responses = await this.responseModel
      .find({
        questionnaireId: question.questionnaire,
        isComplete: true,
      })
      .exec();
    
    // Analyze responses for this specific question
    const questionResponses = responses
      .map(response => {
        const questionResponse = response.responses.find(
          r => r.questionId === questionId,
        );
        return questionResponse ? questionResponse.response : null;
      })
      .filter(response => response !== null);
    
    // Return statistics based on question type
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
      case QuestionType.SINGLE_CHOICE:
        // Count occurrences of each option
        const optionCounts: Record<string, number> = {};
        questionResponses.forEach(response => {
          const values = Array.isArray(response) ? response : [response];
          values.forEach(value => {
            const key = String(value); // Convert to string to ensure it can be used as an object key
            optionCounts[key] = (optionCounts[key] || 0) + 1;
          });
        });
        
        return {
          questionId,
          totalResponses: questionResponses.length,
          optionCounts,
        };
        
      case QuestionType.RATING:
      case QuestionType.SCALE:
      case QuestionType.SLIDER:
        // Calculate average and distribution
        const numericResponses = questionResponses.map(r => Number(r));
        const sum = numericResponses.reduce((a, b) => a + b, 0);
        const avg = sum / numericResponses.length;
        
        // Group responses by value
        const distribution: Record<number, number> = {};
        numericResponses.forEach(value => {
          distribution[value] = (distribution[value] || 0) + 1;
        });
        
        return {
          questionId,
          totalResponses: questionResponses.length,
          average: avg,
          distribution,
        };
        
      default:
        return {
          questionId,
          totalResponses: questionResponses.length,
        };
    }
  }
}
