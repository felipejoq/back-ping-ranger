import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class SseAuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const backendUrl =
        this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:3000';
      this.jwks = createRemoteJWKSet(new URL(`${backendUrl}/api/auth/jwks`));
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      query: Record<string, string>;
      auth?: { userId: string };
    }>();

    const token = request.query?.token;
    if (!token) throw new UnauthorizedException('Token required');

    try {
      const { payload } = await jwtVerify(token, this.getJwks());
      request.auth = { userId: payload.sub as string };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
