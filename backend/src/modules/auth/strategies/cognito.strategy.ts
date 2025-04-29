import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import * as AWS from 'aws-sdk';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

@Injectable()
export class CognitoStrategy extends PassportStrategy(Strategy, 'cognito') {
  private cognitoIdp: CognitoIdentityServiceProvider;
  private userPoolId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      authorizationURL: `https://${configService.get('COGNITO_DOMAIN')}/oauth2/authorize`,
      tokenURL: `https://${configService.get('COGNITO_DOMAIN')}/oauth2/token`,
      clientID: configService.get('COGNITO_APP_CLIENT_ID'),
      callbackURL: configService.get('COGNITO_CALLBACK_URL'),
      scope: ['email', 'openid', 'profile'],
    });

    this.userPoolId = configService.get('COGNITO_USER_POOL_ID') || '';
    this.cognitoIdp = new AWS.CognitoIdentityServiceProvider({
      region: configService.get('AWS_REGION'),
      accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
    });
  }

  async validate(accessToken: string, refreshToken: string): Promise<any> {
    try {
      // Get user info from Cognito
      const userInfo = await this.getUserInfo(accessToken);
      const { sub, email, email_verified, given_name, family_name } = userInfo;
      
      // Find or create user in our database
      const user = await this.authService.findOrCreateCognitoUser({
        cognitoId: sub,
        email,
        emailVerified: email_verified === 'true',
        firstName: given_name,
        lastName: family_name,
      });
      
      // Update last login timestamp
      await this.authService.updateLastLogin(user.id);
      
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid Cognito token');
    }
  }

  private async getUserInfo(accessToken: string): Promise<any> {
    // Get user info from Cognito
    return new Promise((resolve, reject) => {
      this.cognitoIdp.getUser(
        {
          AccessToken: accessToken,
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Convert User Attributes from Cognito format to a more usable object
          const userInfo = data.UserAttributes.reduce((acc: Record<string, string>, attribute: {Name: string; Value: string}) => {
            acc[attribute.Name] = attribute.Value;
            return acc;
          }, {} as Record<string, string>);
          
          resolve(userInfo);
        },
      );
    });
  }
}
