import { Controller, Get, Post, Body, Req, Res, UseGuards, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Redirect to Cognito login page
   */
  @Get('login')
  @UseGuards(AuthGuard('cognito'))
  cognitoLogin() {
    // This endpoint doesn't return - redirects to Cognito
  }

  /**
   * Handle callback from Cognito OAuth2 authentication
   */
  @Get('callback')
  @UseGuards(AuthGuard('cognito'))
  async cognitoCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    // The user object is attached by the CognitoStrategy
    const tokens = await this.authService.generateTokens(req.user);

    // Redirect to frontend with tokens (or use a session-based approach)
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/auth/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`);
  }

  /**
   * Refresh JWT token
   */
  @Post('refresh')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  /**
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Req() req: AuthenticatedRequest) {
    // The user object is attached by the JwtStrategy
    return {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      fullName: req.user.fullName,
      profileCompleted: req.user.profileCompleted,
      questionnaireCompleted: req.user.questionnaireCompleted,
      authProvider: req.user.authProvider,
      subscriptionTier: req.user.subscriptionTier
    };
  }

  /**
   * Logout user
   */
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Res() res: Response) {
    // For JWT-based auth client should discard tokens
    // If using Cognito directly redirect to Cognito logout page
    const cognitoDomain = this.configService.get('COGNITO_DOMAIN');
    const logoutUrl = this.configService.get('COGNITO_LOGOUT_URL');

    if (cognitoDomain && logoutUrl) {
      return res.status(HttpStatus.OK).json({
        logoutUrl: `https://${cognitoDomain}/logout?client_id=${this.configService.get('COGNITO_APP_CLIENT_ID')}&logout_uri=${logoutUrl}`
      });
    }

    return res.status(HttpStatus.OK).json({ message: 'Logged out successfully' });
  }
}
