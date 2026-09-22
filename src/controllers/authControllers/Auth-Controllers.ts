import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import userService from '../../database/User-Service.js';
import { sendMail } from '../../utils/Send-Email.js';
import { User } from '../../schemas/index.js';
import { blacklistToken, isBlacklisted } from '../../utils/Black-List.js';
import {
  attachCookiesToResponse,
  forgot,
  verifyJWT,
  generateCSRFToken,
} from '../../utils/jwt.js';
import redisClient from '../../utils/Get-Redis-Client.js';
import { ApiResponse } from '../../utils/api-response.js';
import config from '../../config/nexus.config.js';

const register = async (req: Request, res: Response) => {
  try {
    const user = await userService.createUser(req.body);

    const jwtToken = forgot(user.verifyToken!, user.email);

    res.cookie('verifyEmail', jwtToken, {
      httpOnly: true,
      maxAge: 3600000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    const sanitizedUser = {
      ...user,
      secondEmail: user.secondEmail ?? undefined,
      role: user.role as import('../../schemas/index.js').Role,
    };
    const tokens = await attachCookiesToResponse(res, sanitizedUser);

    const verificationLink = `${config.clientUrl}/auth/verify-email?token=${jwtToken}`;
    await sendMail(
      user.email,
      'NexusCommerce - Verify Your Email',
      `
        <h2>Welcome to NexusCommerce!</h2>
        <p>Please click this link to verify your email address:</p>
        <a href="${verificationLink}">${verificationLink}</a>
      `
    ).catch(() => {});

    return ApiResponse.created({
      res,
      message: 'User registered successfully. Please verify your email.',
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        csrfToken: tokens.csrfToken,
        token: tokens.accessToken,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Registration failed';
    return ApiResponse.error({
      res,
      statusCode: 400,
      message: errorMessage,
      error,
    });
  }
};

const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      ApiResponse.error({ res, statusCode: 400, message: 'No verification token provided' });
      return;
    }

    try {
      const decoded = verifyJWT(token) as { code: string; email: string };
      if (decoded?.code) {
        await userService.verifyEmail(decoded.code);
        res.clearCookie('verifyEmail');
        ApiResponse.success({ res, message: 'Email verified successfully' });
        return;
      }
    } catch {
      await userService.verifyEmail(token);
      res.clearCookie('verifyEmail');
      ApiResponse.success({ res, message: 'Email verified successfully' });
      return;
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Email verification failed';
    ApiResponse.error({ res, statusCode: 400, message: errorMessage, error });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    if (!req.body.email || !req.body.password) {
      return ApiResponse.error({
        res,
        statusCode: 400,
        message: 'Email and password are required',
      });
    }

    const user = await userService.login(req.body);

    const sanitizedUser = {
      ...user,
      secondEmail: user.secondEmail ?? undefined,
      role: user.role as import('../../schemas/index.js').Role,
    };
    const tokens = await attachCookiesToResponse(res, sanitizedUser);

    if (user.secondEmail) {
      return ApiResponse.success({
        res,
        message: '2FA authentication code required',
        data: {
          username: user.username,
          csrfToken: tokens.csrfToken,
          token: tokens.accessToken,
          requiresSecondFactor: true,
        },
      });
    }

    return ApiResponse.success({
      res,
      message: 'Login successful',
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        csrfToken: tokens.csrfToken,
        token: tokens.accessToken,
      },
    });
  } catch (error) {
    return ApiResponse.error({
      res,
      statusCode: 401,
      message: error instanceof Error ? error.message : 'Invalid credentials',
      error,
    });
  }
};

const loginWithGoogle = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Google authentication failed' });
      return;
    }

    const user = req.user as User;
    const tokens = await attachCookiesToResponse(res, user);

    ApiResponse.success({
      res,
      message: 'Google login successful',
      data: {
        username: user.username,
        email: user.email,
        csrfToken: tokens.csrfToken,
        token: tokens.accessToken,
      },
    });
  } catch (error) {
    ApiResponse.error({ res, statusCode: 500, message: 'Internal Server Error', error });
  }
};

const logout = async (req: Request, res: Response) => {
  if (!req.user) {
    return ApiResponse.error({ res, statusCode: 401, message: 'Authentication required' });
  }

  const user = req.user as User;
  const refreshToken = req.cookies?.refreshToken;

  await userService.deleteRefreshToken(user.id).catch(() => {});

  if (refreshToken) {
    try {
      const decoded = jwt.decode(refreshToken) as { exp?: number };
      if (decoded?.exp) {
        const expiryMs = decoded.exp * 1000 - Date.now();
        if (expiryMs > 0) {
          await blacklistToken(refreshToken, expiryMs);
        }
      }
    } catch {
      // Ignore token decode error on logout
    }
  }

  res.cookie('jwt', 'logout', { httpOnly: true, maxAge: 1 });
  res.cookie('refreshToken', 'logout', { httpOnly: true, maxAge: 1 });
  res.cookie('XSRF-TOKEN', 'logout', { httpOnly: false, maxAge: 1 });

  return ApiResponse.success({ res, message: 'Logout successful' });
};

const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await userService.findUserByEmail(email);
    if (!user) {
      ApiResponse.success({
        res,
        message: 'If your email is registered, you will receive a password reset link',
      });
      return;
    }

    const resetToken = await userService.makeToken(email);
    const jwtToken = forgot(resetToken, user.email);
    res.cookie('passwordReset', jwtToken, {
      httpOnly: true,
      maxAge: 3600000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    await sendMail(
      email,
      'NexusCommerce - Password Reset Request',
      `
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <p>Please return to the app and enter this code:</p>
        <h3>${resetToken}</h3>
        <p>This code will expire in 1 hour.</p>
      `
    ).catch(() => {});

    ApiResponse.success({
      res,
      message: 'If your email is registered, you will receive a password reset code',
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: 'Password reset request failed',
      error,
    });
  }
};

const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resetCode, newPassword, email } = req.body;
    const jwtToken = req.cookies?.passwordReset;

    if (!resetCode || !newPassword || !email || !jwtToken) {
      ApiResponse.error({ res, statusCode: 400, message: 'Missing required reset fields' });
      return;
    }

    const passwordPattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordPattern.test(newPassword)) {
      ApiResponse.error({
        res,
        statusCode: 400,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      });
      return;
    }

    const decoded = verifyJWT(jwtToken);
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !decoded.code ||
      !decoded.email ||
      decoded.email !== email ||
      decoded.code !== resetCode
    ) {
      ApiResponse.error({ res, statusCode: 401, message: 'Invalid or expired password reset session' });
      return;
    }

    const user = await userService.findUserByEmail(email);
    if (!user?.verifyToken || user.verifyToken !== decoded.code) {
      ApiResponse.error({ res, statusCode: 401, message: 'Invalid or expired reset token' });
      return;
    }

    await userService.updateUserInfo({ password: newPassword }, email);
    await userService.clearResetToken(email);

    res.cookie('passwordReset', 'logout', { httpOnly: true, maxAge: 1 });
    ApiResponse.success({ res, message: 'Password successfully reset' });
  } catch (error) {
    ApiResponse.error({ res, statusCode: 500, message: 'Failed to reset password', error });
  }
};

const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    ApiResponse.error({ res, statusCode: 401, message: 'Refresh token is required' });
    return;
  }

  const blacklisted = await isBlacklisted(refreshToken);
  if (blacklisted) {
    ApiResponse.error({ res, statusCode: 403, message: 'Token is invalid or blacklisted' });
    return;
  }

  const storedToken = await userService.findRefreshToken(refreshToken);
  if (!storedToken) {
    ApiResponse.error({ res, statusCode: 403, message: 'Refresh token not found' });
    return;
  }

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || config.jwt.refreshSecret
    ) as jwt.JwtPayload;

    const user = await userService.findUserById(payload.id);
    if (!user) {
      ApiResponse.error({ res, statusCode: 404, message: 'User not found' });
      return;
    }

    const oldToken = refreshToken;
    const decoded = jwt.decode(oldToken) as { exp?: number };
    if (decoded?.exp) {
      const expiryMs = decoded.exp * 1000 - Date.now();
      if (expiryMs > 0) {
        await blacklistToken(oldToken, expiryMs);
      }
    }

    const accessSecret = process.env.ACCESS_TOKEN_SECRET || config.jwt.accessSecret;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || config.jwt.refreshSecret;

    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      accessSecret,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id },
      refreshSecret,
      { expiresIn: '7d' }
    );

    const token = {
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    await userService.refreshToken(token);

    const newCsrfToken = generateCSRFToken();

    res.cookie('jwt', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000,
      sameSite: 'lax',
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.cookie('XSRF-TOKEN', newCsrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000,
      sameSite: 'lax',
    });

    ApiResponse.success({
      res,
      message: 'Access token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        csrfToken: newCsrfToken,
      },
    });
  } catch {
    ApiResponse.error({ res, statusCode: 403, message: 'Invalid refresh token' });
  }
};

const addsecondEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    await userService.addEmail(user.id, req.body.secondEmail);
    ApiResponse.success({ res, message: 'Second email added successfully' });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Server Error',
    });
  }
};

const Reqest2fa = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;

    if (!user?.secondEmail) {
      ApiResponse.error({ res, statusCode: 400, message: 'Second email is not configured' });
      return;
    }

    const userId = (req.user as { id: string }).id;
    const code = crypto.randomUUID();
    const sixDigitCode = code.slice(0, 6);

    await redisClient.set(userId, sixDigitCode, { EX: 600 });

    await sendMail(
      user.secondEmail,
      'NexusCommerce - Two-Factor Authentication Code',
      `
        <h2>Two-Factor Authentication</h2>
        <p>Your 2FA verification code is:</p>
        <h3>${sixDigitCode}</h3>
        <p>This code will expire in 10 minutes.</p>
      `
    ).catch(() => {});

    ApiResponse.success({ res, message: 'Verification code sent to email.' });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Server Error',
    });
  }
};

const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    const reqCode = req.body.code;

    if (!user?.secondEmail) {
      ApiResponse.error({ res, statusCode: 400, message: 'Second email is not set' });
      return;
    }

    const storedCode = await redisClient.get(user.id);
    if (!storedCode) {
      ApiResponse.error({ res, statusCode: 400, message: 'No verification code found or code expired' });
      return;
    }

    if (storedCode === reqCode) {
      await redisClient.del(user.id);
      ApiResponse.success({ res, message: '2FA verification successful' });
    } else {
      ApiResponse.error({ res, statusCode: 401, message: 'Invalid or expired 2FA code' });
    }
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Server Error',
    });
  }
};

export {
  register,
  verifyEmail,
  login,
  logout,
  loginWithGoogle,
  resetPassword,
  forgotPassword,
  refresh,
  addsecondEmail,
  Reqest2fa,
  verify2FA,
};
