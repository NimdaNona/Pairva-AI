import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { QuestionnaireService } from './questionnaire.service';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestionnaireCategory, QuestionnaireStatus } from './schemas/questionnaire.schema';

// Interface for the request object with user property from JWT
interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('questionnaire')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('questionnaire')
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  // ----- Questionnaire Endpoints -----

  @Post()
  @ApiOperation({ summary: 'Create a new questionnaire (admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Questionnaire created successfully' })
  async createQuestionnaire(@Body() createQuestionnaireDto: CreateQuestionnaireDto) {
    return this.questionnaireService.createQuestionnaire(createQuestionnaireDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all questionnaires with optional filters' })
  @ApiQuery({ name: 'category', enum: QuestionnaireCategory, required: false })
  @ApiQuery({ name: 'status', enum: QuestionnaireStatus, required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  async findAllQuestionnaires(
    @Query('category') category?: QuestionnaireCategory,
    @Query('status') status?: QuestionnaireStatus,
    @Query('isActive') isActive?: boolean,
  ) {
    const filters: any = {};
    
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (isActive !== undefined) filters.isActive = isActive === true;
    
    return this.questionnaireService.findAllQuestionnaires(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a questionnaire by ID' })
  @ApiParam({ name: 'id', description: 'Questionnaire ID' })
  async findQuestionnaireById(@Param('id') id: string) {
    return this.questionnaireService.findQuestionnaireById(id);
  }

  @Get(':id/questions')
  @ApiOperation({ summary: 'Get a questionnaire with its questions' })
  @ApiParam({ name: 'id', description: 'Questionnaire ID' })
  async findQuestionnaireWithQuestions(@Param('id') id: string) {
    return this.questionnaireService.findQuestionnaireWithQuestions(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a questionnaire (admin only)' })
  @ApiParam({ name: 'id', description: 'Questionnaire ID' })
  async updateQuestionnaire(
    @Param('id') id: string,
    @Body() updateQuestionnaireDto: UpdateQuestionnaireDto,
  ) {
    return this.questionnaireService.updateQuestionnaire(id, updateQuestionnaireDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a questionnaire (admin only)' })
  @ApiParam({ name: 'id', description: 'Questionnaire ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Questionnaire deleted successfully' })
  async deleteQuestionnaire(@Param('id') id: string) {
    await this.questionnaireService.deleteQuestionnaire(id);
    return { message: 'Questionnaire deleted successfully' };
  }

  // ----- Question Endpoints -----

  @Post(':questionnaireId/questions')
  @ApiOperation({ summary: 'Create a new question for a questionnaire (admin only)' })
  @ApiParam({ name: 'questionnaireId', description: 'Questionnaire ID' })
  async createQuestion(
    @Param('questionnaireId') questionnaireId: string,
    @Body() createQuestionDto: CreateQuestionDto,
  ) {
    return this.questionnaireService.createQuestion(questionnaireId, createQuestionDto);
  }

  @Get(':questionnaireId/questions')
  @ApiOperation({ summary: 'Get all questions for a questionnaire' })
  @ApiParam({ name: 'questionnaireId', description: 'Questionnaire ID' })
  async findQuestionsByQuestionnaire(@Param('questionnaireId') questionnaireId: string) {
    return this.questionnaireService.findQuestionsByQuestionnaire(questionnaireId);
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Get a question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  async findQuestionById(@Param('id') id: string) {
    return this.questionnaireService.findQuestionById(id);
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Update a question (admin only)' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionnaireService.updateQuestion(id, updateQuestionDto);
  }

  @Delete('questions/:id')
  @ApiOperation({ summary: 'Delete a question (admin only)' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Question deleted successfully' })
  async deleteQuestion(@Param('id') id: string) {
    await this.questionnaireService.deleteQuestion(id);
    return { message: 'Question deleted successfully' };
  }

  // ----- Response Endpoints -----

  @Post(':questionnaireId/responses')
  @ApiOperation({ summary: 'Submit a response to a questionnaire' })
  @ApiParam({ name: 'questionnaireId', description: 'Questionnaire ID' })
  async submitResponse(
    @Request() req: RequestWithUser,
    @Param('questionnaireId') questionnaireId: string,
    @Body() submitResponseDto: SubmitResponseDto,
    @Query('profileId') profileId?: string,
  ) {
    const userId = req.user.id;
    
    return this.questionnaireService.submitResponse(
      userId,
      profileId || userId, // Use profileId if provided, otherwise use userId
      questionnaireId,
      submitResponseDto,
    );
  }

  @Get(':questionnaireId/myresponse')
  @ApiOperation({ summary: "Get the user's response to a questionnaire" })
  @ApiParam({ name: 'questionnaireId', description: 'Questionnaire ID' })
  async getUserResponse(
    @Request() req: RequestWithUser,
    @Param('questionnaireId') questionnaireId: string,
  ) {
    const userId = req.user.id;
    return this.questionnaireService.getUserResponse(userId, questionnaireId);
  }

  // ----- Analytics Endpoints -----

  @Get(':questionnaireId/stats/completion')
  @ApiOperation({ summary: 'Get completion rate for a questionnaire (admin only)' })
  @ApiParam({ name: 'questionnaireId', description: 'Questionnaire ID' })
  async getCompletionRate(@Param('questionnaireId') questionnaireId: string) {
    const rate = await this.questionnaireService.getCompletionRate(questionnaireId);
    return { completionRate: rate };
  }

  @Get('questions/:id/stats')
  @ApiOperation({ summary: 'Get response statistics for a question (admin only)' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  async getQuestionStats(@Param('id') id: string) {
    return this.questionnaireService.getQuestionStats(id);
  }
}
