import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      theme_preference: user.theme_preference,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}
