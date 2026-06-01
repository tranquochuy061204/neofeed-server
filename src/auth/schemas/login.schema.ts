import z from 'zod';

export const LoginSchema = z.object({
  email: z.email({ error: 'Email không hợp lệ' }),
  password: z.string().min(1, { error: 'Mật khẩu không được để trống' }),
});

export type LoginDto = z.infer<typeof LoginSchema>;
