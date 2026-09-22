import { Prisma, PrismaClient } from '@prisma/client';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { logger } from '../Utils/logger.js';

import {
  Login,
  loginSchema,
  RefreshToken,
  inputuser,
  User,
} from '../Schemas/index.js';

import {
  AppError,
  NotFoundError,
  UnauthorizedError,
} from '../Errors/Custom-errors.js';

const prisma = new PrismaClient();

class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(data: unknown) {
    const validData = inputuser.parse(data);

    return await this.prisma.$transaction(async (prisma) => {
      if (validData.password) {
        validData.password = await bcrypt.hash(validData.password, 13);
      }

      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      });

      const userData = {
        ...validData,
        googleId: validData.googleId || undefined,
        verifyToken: crypto.randomBytes(32).toString('hex'),
        isVerified: false,
        role: adminCount === 0 ? Role.ADMIN : Role.USER,
      };

      return prisma.user.create({
        data: userData,
      });
    });
  }

  async verifyEmail(token: string) {
    return await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.findFirst({
        where: { verifyToken: token },
      });

      if (!user) {
        throw new NotFoundError('Invalid or expired verification token');
      }

      return prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, verifyToken: null },
      });
    });
  }

  async login(data: Login) {
    const validData = loginSchema.parse(data);
    const user = await prisma.user.findUnique({
      where: {
        email: validData.email,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedError('Please verify your email before logging in');
    }

    if (user.password === null && user.googleId) {
      throw new UnauthorizedError('Please login using Google');
    }

    const passwordMatch = await bcrypt.compare(
      validData.password,
      user.password as string
    );
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return user;
  }

  async findUserByGoogleId(googleId: string) {
    return await prisma.user.findUnique({ where: { googleId } });
  }

  async findUserById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(`User not found`);
    }
    return user;
  }

  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({ where: { email } });
  }

  async updateUserInfo(data: Partial<User>, email: string) {
    const updateData: Record<string, any> = {};

    if (data.password)
      updateData.password = await bcrypt.hash(data.password, 13);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    return await prisma.user.update({
      where: { email },
      data: updateData,
    });
  }

  async makeToken(email: string): Promise<string> {
    const verifyToken = crypto.randomBytes(32).toString('hex');

    try {
      await prisma.user.update({
        where: { email },
        data: {
          verifyToken,
        },
      });

      return verifyToken;
    } catch (error) {
      logger.error('Failed to generate and store token:', error);
      throw new AppError(
        'Could not create verification token',
        500,
        'TOKEN_CREATION_ERROR'
      );
    }
  }

  async clearResetToken(email: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { email },
        data: {
          verifyToken: null,
        },
      });
    } catch (error) {
      logger.error(`Failed to clear reset token for ${email}:`, error);
      throw new AppError(
        'Failed to clear reset token',
        500,
        'TOKEN_CLEAR_ERROR'
      );
    }
  }

  async refreshToken(token: RefreshToken) {
    return await this.prisma.refreshToken.upsert({
      where: { userId: token.userId },
      update: {
        token: token.token,
        expiresAt: token.expiresAt,
      },
      create: {
        token: token.token,
        userId: token.userId,
        expiresAt: token.expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return await this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async deleteRefreshToken(userId: string) {
    await this.prisma.refreshToken.delete({
      where: { userId: userId },
    });
  }

  async addEmail(userId: string, email: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { secondEmail: email },
    });
  }
}

const userService = new UserService(prisma);
export default userService;
