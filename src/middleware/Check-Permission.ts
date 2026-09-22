import { Request, Response, NextFunction } from 'express';
import { rolePermissions, Role, Resource, Action } from '../config/roles.js';
import { User } from '../schemas/index.js';
import { ForbiddenError, UnauthorizedError } from '../errors/Custom-errors.js';

export const checkPermission = (resource: Resource, action: Action) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required to access this resource');
      }

      const userRole = (req.user as User).role as Role;

      if (!userRole) {
        throw new UnauthorizedError('User has no role assigned');
      }

      const permissions = rolePermissions[userRole]?.[resource];

      if (!permissions || !permissions.includes(action)) {
        throw new ForbiddenError(
          `Access Denied: Role '${userRole}' lacks '${action}' permission for '${resource}'`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
