import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import type { RegisterDto } from './schemas/register.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string) {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, email },
        {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m') as any,
        },
      ),
      this.jwt.signAsync(
        { sub: userId },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '7d',
          ) as any,
        },
      ),
    ]);
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, rawToken: string) {
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const rt = this.refreshTokenRepo.create({ userId, tokenHash, expiresAt });
    await this.refreshTokenRepo.save(rt);
  }

  // ─── Auth actions ─────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email đã được sử dụng');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      ...tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  async login(userId: string, email: string) {
    const tokens = await this.generateTokens(userId, email);
    await this.storeRefreshToken(userId, tokens.refreshToken);
    return tokens;
  }

  async refresh(userId: string, rawRefreshToken: string) {
    const stored = await this.refreshTokenRepo.findBy({
      userId,
      expiresAt: MoreThan(new Date()),
    });

    const results = await Promise.all(
      stored.map(async (rt) => {
        const ok = await bcrypt.compare(rawRefreshToken, rt.tokenHash);
        return ok ? rt : null;
      }),
    );
    const matched = results.find(Boolean) ?? null;

    if (!matched) throw new UnauthorizedException('Refresh token không hợp lệ');

    const user = await this.users.findById(userId);

    // Rotate: delete old, issue new pair
    await this.refreshTokenRepo.delete(matched.id);
    const tokens = await this.generateTokens(userId, user.email);
    await this.storeRefreshToken(userId, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, rawRefreshToken: string) {
    const stored = await this.refreshTokenRepo.findBy({ userId });

    const results = await Promise.all(
      stored.map(async (rt) => {
        const ok = await bcrypt.compare(rawRefreshToken, rt.tokenHash);
        return ok ? rt : null;
      }),
    );
    const matched = results.find(Boolean) ?? null;

    if (matched) {
      await this.refreshTokenRepo.delete(matched.id);
    }
  }

  async getMe(userId: string) {
    const user = await this.users.findById(userId);
    return { id: user.id, email: user.email, name: user.name };
  }
}
