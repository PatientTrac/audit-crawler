import pg from 'pg';
import { CONFIG } from '../config.js';
export const db = new pg.Pool({ connectionString: CONFIG.databaseUrl });
