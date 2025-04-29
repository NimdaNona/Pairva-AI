import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionType } from '../schemas/question.schema';

export class QuestionOptionDto {
  @ApiProperty({ description: 'Unique identifier for the option' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Display text for the option' })
  @IsString()
  text: string;

  @ApiProperty({ description: 'Value for the option that will be stored in responses' })
  value: string | number;

  @ApiPropertyOptional({ description: 'Additional metadata for the option' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class QuestionValidationDto {
  @ApiPropertyOptional({ description: 'Minimum value for number responses' })
  @IsNumber()
  @IsOptional()
  min?: number;

  @ApiPropertyOptional({ description: 'Maximum value for number responses' })
  @IsNumber()
  @IsOptional()
  max?: number;

  @ApiPropertyOptional({ description: 'Minimum length for text responses' })
  @IsNumber()
  @IsOptional()
  minLength?: number;

  @ApiPropertyOptional({ description: 'Maximum length for text responses' })
  @IsNumber()
  @IsOptional()
  maxLength?: number;

  @ApiPropertyOptional({ description: 'Regex pattern for validation' })
  @IsString()
  @IsOptional()
  pattern?: string;
}

export class QuestionMetadataDto {
  @ApiPropertyOptional({ description: 'Weight of this question in AI matching (0-1)' })
  @IsNumber()
  @IsOptional()
  aiMatchingWeight?: number;

  @ApiPropertyOptional({ description: 'Compatibility factor this question measures' })
  @IsString()
  @IsOptional()
  compatibilityFactor?: string;

  @ApiPropertyOptional({ description: 'Category for grouping questions' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Condition for displaying this question' })
  @IsObject()
  @IsOptional()
  displayCondition?: Record<string, any>;

  // Additional properties are allowed without decorators
  [key: string]: any;
}

export class CreateQuestionDto {
  @ApiProperty({ description: 'Question text' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Description or explanation of the question' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Type of question',
    enum: QuestionType,
  })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiPropertyOptional({
    description: 'Whether this question requires an answer',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Display order of the question',
  })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: 'Options for multiple-choice questions',
    type: [QuestionOptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @IsOptional()
  options?: QuestionOptionDto[];

  @ApiPropertyOptional({
    description: 'Validation rules for the question',
    type: QuestionValidationDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => QuestionValidationDto)
  @IsOptional()
  validations?: QuestionValidationDto;

  @ApiPropertyOptional({
    description: 'Additional metadata for the question',
    type: QuestionMetadataDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => QuestionMetadataDto)
  @IsOptional()
  metadata?: QuestionMetadataDto;

  @ApiPropertyOptional({
    description: 'Whether this question is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
