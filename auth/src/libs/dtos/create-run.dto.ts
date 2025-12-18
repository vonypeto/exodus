import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModelConfigDto {
  @IsString()
  model!: string;

  @IsString()
  provider!: string;
}

export class RunConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  concurrencyLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  retryAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  timeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerSecond?: number;

  @IsOptional()
  @IsBoolean()
  enableCircuitBreaker?: boolean;
}

export class CreateRunDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  prompts!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  brands!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ModelConfigDto)
  models!: ModelConfigDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RunConfigDto)
  config?: RunConfigDto;
}
