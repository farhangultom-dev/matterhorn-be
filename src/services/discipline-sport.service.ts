import { findActiveDisciplineSports, type DisciplineSportRecord } from '../models/discipline-sport.model';

export const getAllDisciplineSports = async (): Promise<DisciplineSportRecord[]> => findActiveDisciplineSports();
