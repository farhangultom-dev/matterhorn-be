import type { RequestHandler } from 'express';
import { getAllDisciplineSports } from '../services/discipline-sport.service';
import { successResponse } from '../views/response.view';
import { presentDisciplineSport } from '../views/discipline-sport.view';

export const getDisciplineSportsController: RequestHandler = async (_request, response) => {
  const sports = await getAllDisciplineSports();
  response.json(successResponse('Discipline sports retrieved', { disciplineSports: sports.map(presentDisciplineSport) }));
};
