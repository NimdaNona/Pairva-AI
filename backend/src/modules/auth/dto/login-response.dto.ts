/**
 * DTO for login response
 */
export class LoginResponseDto {
  /**
   * JWT access token
   */
  accessToken: string;

  /**
   * JWT refresh token
   */
  refreshToken: string;

  /**
   * Token expiration time
   */
  expiresIn: string;

  /**
   * User information
   */
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    profileCompleted: boolean;
    questionnaireCompleted: boolean;
    authProvider: string;
    subscriptionTier: string;
  };
}
