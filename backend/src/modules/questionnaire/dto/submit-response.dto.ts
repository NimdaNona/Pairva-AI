import { IsArray, IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionResponseDto {
  @ApiProperty({ description: 'ID of the question being answered' })
  questionId: string;

  @ApiProperty({ description: 'The response value (can be string, number, boolean, or array)' })
  response: string | number | boolean | string[] | number[];

  @ApiPropertyOptional({ description: 'Additional metadata about this response' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class SubmitResponseDto {
  @ApiProperty({
    description: 'Array of question responses',
    type: [QuestionResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionResponseDto)
  responses: QuestionResponseDto[];

  @ApiPropertyOptional({
    description: 'Whether this response is complete',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isComplete?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata about this response',
    type: 'object',
  })
  @IsObject()
  @IsOptional()
  metadata?: {
    timeSpent?: number;
    sourceDevice?: string;
    [key: string]: any;
  };
}
