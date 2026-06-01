import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RegisterSchema, type RegisterDto } from './schemas/register.schema';
import { LoginSchema } from './schemas/login.schema';
import {
  LoginBodyDto,
  MessageResponseDto,
  RegisterBodyDto,
  RegisterResponseDto,
  TokenResponseDto,
  UserResponseDto,
} from './dto/auth-swagger.dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiBody({ type: RegisterBodyDto })
  @ApiResponse({
    status: 201,
    type: RegisterResponseDto,
    description: 'Đăng ký thành công, trả về access token + user',
  })
  @ApiConflictResponse({ description: 'Email đã được sử dụng' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.register(dto);
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return rest;
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email + password' })
  @ApiBody({ type: LoginBodyDto })
  @ApiOkResponse({
    type: TokenResponseDto,
    description: 'Đăng nhập thành công',
  })
  @ApiUnauthorizedResponse({ description: 'Email hoặc mật khẩu không đúng' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) _dto: unknown,
    @Request() req: { user: { id: string; email: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.login(
      req.user.id,
      req.user.email,
    );
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return rest;
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('refresh-token')
  @ApiOperation({
    summary: 'Lấy access token mới bằng refresh token từ cookie',
  })
  @ApiOkResponse({ type: TokenResponseDto, description: 'Token mới' })
  @ApiUnauthorizedResponse({
    description: 'Refresh token không hợp lệ hoặc đã hết hạn',
  })
  async refresh(
    @Request() req: { user: { id: string; refreshToken: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...rest } = await this.authService.refresh(
      req.user.id,
      req.user.refreshToken,
    );
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return rest;
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('refresh-token')
  @ApiOperation({ summary: 'Đăng xuất — thu hồi refresh token hiện tại' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @Request() req: { user: { id: string; refreshToken: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id, req.user.refreshToken);
    res.clearCookie('refresh_token');
    return { message: 'Đăng xuất thành công' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Access token không hợp lệ hoặc đã hết hạn',
  })
  me(@Request() req: { user: { id: string } }) {
    return this.authService.getMe(req.user.id);
  }
}
