import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { Request, Response } from 'express';
import { auth } from './auth.service';
import { Public } from './public.decorator';

@Controller()
@Public()
export class AuthController {
  private readonly handler = toNodeHandler(auth);

  @All('/api/auth/*path')
  handleAuth(@Req() req: Request, @Res() res: Response) {
    this.handler(req, res);
  }
}
