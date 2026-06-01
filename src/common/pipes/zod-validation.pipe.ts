import { PipeTransform, BadRequestException } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const flat = result.error.flatten();
      throw new BadRequestException({
        message: 'Validation failed',
        errors: flat.fieldErrors,
      });
    }

    return result.data;
  }
}
