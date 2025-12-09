import { IsArray, IsOptional, IsString } from 'class-validator';

export class StartRunDto {
  @IsArray()
  prompts: string[];

  @IsArray()
  brands: string[];

  @IsArray()
  models: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
