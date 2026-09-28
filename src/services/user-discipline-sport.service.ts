import { getDatabase } from '../config/database';
import {
  insertUserDisciplineSport,
  UserDisciplineSportAlreadyExistsError,
  UserDisciplineSportNotFoundError,
  UserDisciplineSportUserNotFoundError,
  type UserDisciplineSportRecord,
} from '../models/user-discipline-sport.model';
import type { AddUserDisciplineSportInput } from '../validations/user-discipline-sport.validation';
import { AppError } from '../utils/app-error';

export const addUserDisciplineSport = async (
  userId: string,
  input: AddUserDisciplineSportInput,
): Promise<UserDisciplineSportRecord> => {
  try {
    return await getDatabase().transaction((transaction) =>
      insertUserDisciplineSport(transaction, userId, input.disciplineSportId),
    );
  } catch (error) {
    if (error instanceof UserDisciplineSportUserNotFoundError) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (error instanceof UserDisciplineSportNotFoundError) {
      throw new AppError(404, 'DISCIPLINE_SPORT_NOT_FOUND', 'Discipline sport not found');
    }
    if (error instanceof UserDisciplineSportAlreadyExistsError) {
      throw new AppError(409, 'USER_DISCIPLINE_SPORT_ALREADY_EXISTS', 'User already has this discipline sport');
    }
    throw error;
  }
};
