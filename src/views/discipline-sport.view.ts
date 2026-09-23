import type { DisciplineSportRecord } from '../models/discipline-sport.model';

export interface PublicDisciplineSport {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
}

export const presentDisciplineSport = (sport: DisciplineSportRecord): PublicDisciplineSport => ({
  id: sport.id,
  name: sport.name,
  createdAt: new Date(sport.created_at).toISOString(),
});
