import { Injectable, UnauthorizedException, NotFoundException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import { CognitoUserDto } from './dto/cognito-user.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Find a user by their ID
   */
  async findUserById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Find a user by their email
   */
  async findUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  /**
   * Find a user by their Cognito ID
   */
  async findUserByCognitoId(cognitoId: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { cognitoId } });
  }

  /**
   * Find or create a user based on Cognito information
   */
  async findOrCreateCognitoUser(cognitoUserDto: CognitoUserDto): Promise<UserEntity> {
    // Normalize email
    const email = cognitoUserDto.email.toLowerCase();

    // Check if user exists by Cognito ID
    let user = await this.findUserByCognitoId(cognitoUserDto.cognitoId);

    if (user) {
      // Update existing user's information if needed
      user.email = email;
      user.firstName = cognitoUserDto.firstName || user.firstName;
      user.lastName = cognitoUserDto.lastName || user.lastName;
      user.emailVerified = cognitoUserDto.emailVerified;
      return this.userRepository.save(user);
    }

    // Check if user exists by email
    user = await this.findUserByEmail(email);

    if (user) {
      // Associate existing user with Cognito ID
      user.cognitoId = cognitoUserDto.cognitoId;
      user.authProvider = 'cognito';
      user.emailVerified = cognitoUserDto.emailVerified;
      return this.userRepository.save(user);
    }

    // Create new user
    const newUser = this.userRepository.create({
      email,
      firstName: cognitoUserDto.firstName,
      lastName: cognitoUserDto.lastName,
      cognitoId: cognitoUserDto.cognitoId,
      authProvider: 'cognito',
      emailVerified: cognitoUserDto.emailVerified
    });

    return this.userRepository.save(newUser);
  }

  /**
   * Update the last login timestamp for a user
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date()
    });
  }

  /**
   * Generate JWT tokens for a user
   */
  async generateTokens(user: UserEntity): Promise<LoginResponseDto> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      payload,
      {
        expiresIn: this.configService.get('jwt.refreshExpiresIn')
      }
    );

    // Ensure expiresIn is always a string
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '1h';

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        profileCompleted: user.profileCompleted,
        questionnaireCompleted: user.questionnaireCompleted,
        authProvider: user.authProvider,
        subscriptionTier: user.subscriptionTier
      }
    };
  }

  /**
   * Validate JWT refresh token and generate new tokens
   */
  async refreshTokens(refreshToken: string): Promise<LoginResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.secret')
      });

      // Get user
      const user = await this.findUserById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
