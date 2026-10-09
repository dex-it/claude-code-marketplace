export type Role = 'customer' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  password: string;
}
