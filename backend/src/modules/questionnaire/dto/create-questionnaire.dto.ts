import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionnaireCategory, QuestionnaireStatus } from '../schemas/questionnaire.schema';

export class CreateQuestionnaireDto {
  @ApiProperty({ description: 'Title of the questionnaire' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Description of the questionnaire' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Category of the questionnaire',
    enum: QuestionnaireCategory,
  })
  @IsEnum(QuestionnaireCategory)
  category: QuestionnaireCategory;

  @ApiPropertyOptional({
    description: 'Status of the questionnaire',
    enum: QuestionnaireStatus,
    default: QuestionnaireStatus.DRAFT,
  })
  @IsEnum(QuestionnaireStatus)
  @IsOptional()
  status?: QuestionnaireStatus;

  @ApiPropertyOptional({
    description: 'Whether this questionnaire is required for all users',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Display order of the questionnaire',
  })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: 'Whether this questionnaire is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata for the questionnaire',
    type: 'object',
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
