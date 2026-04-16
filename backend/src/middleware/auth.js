import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import Admin from '../models/Admin.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      errors: [],
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = { ...decoded, type: decoded.type || 'user' };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      errors: [],
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Not authenticated.',
        errors: [],
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized.`,
        errors: [],
      });
    }

    next();
  };
};

export const permit = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user || req.user.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    try {
      const admin = await Admin.findById(req.user.id).populate('roleId');
      if (!admin || !admin.isActive) {
        return res.status(403).json({ success: false, message: 'Admin account not found or inactive' });
      }

      const role = admin.roleId;
      if (!role || role.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Role is inactive or not assigned' });
      }

      // Combine role permissions + admin-level overrides
      const allPerms = [...(role.permissions || []), ...(admin.permissions || [])];

      // Wildcard '*' means all permissions (super admin)
      if (allPerms.includes('*')) {
        req.admin = admin;
        req.adminRole = role;
        return next();
      }

      // Check if admin has ALL required permissions
      const hasAll = requiredPermissions.every(p => allPerms.includes(p));
      if (!hasAll) {
        return res.status(403).json({
          success: false,
          message: `Permission denied. Required: ${requiredPermissions.join(', ')}`,
        });
      }

      req.admin = admin;
      req.adminRole = role;
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = { ...decoded, type: decoded.type || 'user' };
  } catch {
    // Invalid token — just continue without setting req.user
  }

  next();
};
