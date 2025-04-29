import { IsString, IsOptional, IsDate, IsEnum, IsObject, IsArray, IsBoolean, IsUrl, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, RelationshipGoal, RelationshipStatus } from '../entities/profile.entity';

class ProfilePhotoDto {
  @IsUrl()
  url: string;

  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isMain?: boolean;
}

class ProfilePreferencesDto {
  @IsOptional()
  ageMin?: number;

  @IsOptional()
  ageMax?: number;

  @IsOptional()
  distance?: number;

  @IsOptional()
  @IsEnum(Gender, { each: true })
  genders?: Gender[];

  @IsOptional()
  @IsEnum(RelationshipGoal, { each: true })
  relationshipGoals?: RelationshipGoal[];
}

class ProfileAttributesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personality?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lifestyle?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  communication?: string[];
}

export class CreateProfileDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  displayName: string;

  @IsDate()
  @Type(() => Date)
  birthDate: Date;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  location: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsEnum(RelationshipGoal)
  relationshipGoal: RelationshipGoal;

  @IsEnum(RelationshipStatus)
  @IsOptional()
  relationshipStatus?: RelationshipStatus = RelationshipStatus.SINGLE;

  @IsString()
  bio: string;

  @IsString()
  interests: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfilePreferencesDto)
  preferences?: ProfilePreferencesDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileAttributesDto)
  attributes?: ProfileAttributesDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfilePhotoDto)
  @IsOptional()
  photos?: ProfilePhotoDto[];
}
