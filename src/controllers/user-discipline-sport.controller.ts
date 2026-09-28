import type { RequestHandler } from 'express';
import { addUserDisciplineSport } from '../services/user-discipline-sport.service';
import type { AddUserDisciplineSportInput } from '../validations/user-discipline-sport.validation';
import { successResponse } from '../views/response.view';

export const addUserDisciplineSportController: RequestHandler = async (request, response) => {
  const sport = await addUserDisciplineSport(
    request.auth!.userId,
    response.locals.validatedBody as AddUserDisciplineSportInput,
  );
  response.status(201).json(successResponse('User discipline sport added', {
    userDisciplineSport: {
      id: sport.id,
      userId: sport.user_id,
      disciplineSportId: sport.discipline_sport_id,
      disciplineSportName: sport.discipline_sport_name,
      cityName: sport.city_name,
      provinceName: sport.province_name,
      createdAt: new Date(sport.created_at).toISOString(),
    },
  }));
};
