import z from 'zod';

export const RegisterSchema = z.object({
  email: z.email({ error: 'Email không hợp lệ' }),
  password: z
    .string()
    .min(8, { error: 'Mật khẩu phải có ít nhất 8 ký tự' })
    .max(100),
  name: z.string().min(1).max(100).optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
