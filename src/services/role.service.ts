import { findActiveRoles, type RoleRecord } from '../models/role.model';

export const getAllRoles = async (): Promise<RoleRecord[]> => findActiveRoles();
