import bcrypt from 'bcrypt';

export const hashPassword = (password: string, saltRounds: number): Promise<string> => bcrypt.hash(password, saltRounds);
export const comparePassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export const dummyPasswordHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7hYv7jVfM6r7J7q3h8q7QX5M5kVx7eW';
