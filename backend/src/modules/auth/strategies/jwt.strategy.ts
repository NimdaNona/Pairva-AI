import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
    });
  }

  async validate(payload: any) {
    // payload is the decoded JWT (from our local JWT verification)
    const { sub } = payload;
    
    // Find user by ID (sub claim)
    const user = await this.authService.findUserById(sub);
    
    if (!user) {
      throw new UnauthorizedException('User not found or token is invalid');
    }
    
    // Pass the user to the request object
    return user;
  }
}
