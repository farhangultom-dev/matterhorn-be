import { getDatabase } from '../config/database';

export interface DisciplineSportRecord {
  readonly id: number;
  readonly name: string;
  readonly created_at: Date;
}

export const findActiveDisciplineSports = async (): Promise<DisciplineSportRecord[]> =>
  getDatabase()<DisciplineSportRecord>('discipline_sports')
    .select('id', 'name', 'created_at')
    .whereNull('deleted_at')
    .orderBy([{ column: 'name', order: 'asc' }, { column: 'id', order: 'asc' }]);
