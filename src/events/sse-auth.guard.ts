import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';

@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      query: Record<string, string>;
      auth?: { userId: string };
    }>();

    const token = request.query?.token;
    if (!token) {
      throw new UnauthorizedException('Token required');
    }

    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY')!;

    try {
      const payload = await verifyToken(token, { secretKey });
      request.auth = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
