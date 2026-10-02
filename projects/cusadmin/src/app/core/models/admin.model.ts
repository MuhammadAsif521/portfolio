/** GET /api/v1/auth/me → data.user (portfolio-node AdminUser; passwordHash is never sent). */
export interface AdminUser {
  _id: string;
  email: string;
  name?: string;
  role: 'admin';
  isActive: boolean;
  /** TOTP two-factor sign-in is on (secrets and recovery codes are never sent). */
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
