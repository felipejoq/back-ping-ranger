import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const monitor = await this.publicService.findBySlug(slug);
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }
}
