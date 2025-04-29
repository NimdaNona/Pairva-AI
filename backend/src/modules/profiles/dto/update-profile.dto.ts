import { IsString, IsOptional, IsDate, IsEnum, IsObject, IsArray, IsBoolean, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, RelationshipGoal, RelationshipStatus } from '../entities/profile.entity';
import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';

/**
 * DTO for updating profile.
 * Extends CreateProfileDto but makes all fields optional.
 */
export class UpdateProfileDto extends PartialType(CreateProfileDto) {
  // Override any fields with specific validation if needed
}
