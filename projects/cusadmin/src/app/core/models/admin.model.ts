/** GET /api/v1/auth/me → data.user (portfolio-node AdminUser; passwordHash is never sent). */
export interface AdminUser {
  _id: string;
  email: string;
  name?: string;
  role: 'admin';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
