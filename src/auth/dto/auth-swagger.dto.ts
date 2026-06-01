import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterBodyDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password (min 8 chars)',
    minLength: 8,
  })
  password: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Display name' })
  name?: string;
}

export class LoginBodyDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'password123' })
  password: string;
}

export class TokenResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15m)' })
  accessToken: string;
}

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', nullable: true })
  name: string | null;
}

export class RegisterResponseDto extends TokenResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Đăng xuất thành công' })
  message: string;
}
