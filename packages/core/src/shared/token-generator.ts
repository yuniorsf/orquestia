import { randomUUID } from 'node:crypto';

export interface TokenGenerator {
  generate(): string;
}

export class RandomTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomUUID();
  }
}
