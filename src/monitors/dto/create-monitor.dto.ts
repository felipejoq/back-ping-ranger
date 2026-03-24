import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

class AlertConfigDto {
  @IsIn(['telegram', 'discord', 'slack'])
  type!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  chatId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  webhookUrl?: string;
}

export class CreateMonitorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsUrl()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  intervalMin?: number = 5;

  @IsOptional()
  @IsBoolean()
  active?: boolean = true;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlertConfigDto)
  alertConfig?: AlertConfigDto;

  @IsOptional()
  @IsBoolean()
  makePublic?: boolean;
}
