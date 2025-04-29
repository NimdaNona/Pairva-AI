import { IsString, IsEmail, IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO for Cognito user information
 */
export class CognitoUserDto {
  @IsString()
  cognitoId: string;

  @IsEmail()
  email: string;

  @IsBoolean()
  emailVerified: boolean;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}
