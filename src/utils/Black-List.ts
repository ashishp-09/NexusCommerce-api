import redis from './Get-Redis-Client.js';

export const blacklistToken = async (token: string, expiryMs: number) => {
  await redis.set(token, 'blacklisted', { PX: expiryMs });
};

export const isBlacklisted = async (token: string) => {
  return (await redis.get(token)) === 'blacklisted';
};
