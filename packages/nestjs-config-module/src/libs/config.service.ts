import { Injectable, Optional, Inject, Global } from '@nestjs/common';
import { Tokens } from './tokens';
import type { ConfigModuleOptions } from './types';
import yaml from 'yamljs';

export class MissingConfigError extends Error {
  constructor(key: string) {
    super(`missing config: key=${key}`);
  }
}

@Global()
@Injectable()
export class ConfigService {
  constructor(
    @Inject(Tokens.ConfigOptions)
    @Optional()
    private options: ConfigModuleOptions
  ) {}
  private get(key: string): string {
    const value = this.options?.data?.[key] || process.env[key];

    if (value === undefined) {
      throw new MissingConfigError(key);
    }

    return value;
  }

  public getString(
    key: string,
    opts?: {
      optional?: true;
    }
  ): string | undefined {
    try {
      return this.get(key);
    } catch (err) {
      if (opts?.optional && err instanceof MissingConfigError) {
        return undefined;
      }

      throw err;
    }
  }

  public getNumber(
    key: string,
    opts?: {
      optional?: true;
    }
  ): number | undefined {
    try {
      return Number(this.get(key));
    } catch (err) {
      if (opts?.optional && err instanceof MissingConfigError) {
        return undefined;
      }

      throw err;
    }
  }

  public getBoolean(key: string): boolean {
    try {
      const value = this.get(key);

      return Boolean(value);
    } catch (err) {
      if (err instanceof MissingConfigError) {
        return false;
      }

      throw err;
    }
  }

  public getObject(
    key: string,
    opts?: {
      optional?: true;
    }
  ): object | undefined {
    try {
      return yaml.parse(this.get(key));
    } catch (err) {
      if (opts?.optional && err instanceof MissingConfigError) {
        return undefined;
      }

      throw err;
    }
  }
}
