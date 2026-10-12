import { Router } from 'express';
import {
  getEffortStats,
  getHabitsToday,
  getOverviewStats,
  getStreakStats,
  putHabitsToday,
} from '../controllers/habits.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** /api/habits/... · check-in diario (todas exigen sesión). */
export const habitsRouter = Router();

habitsRouter.use(requireAuth);

habitsRouter.get('/today', getHabitsToday);
habitsRouter.put('/today', putHabitsToday);

/** /api/stats/... · estadísticas del Dashboard (todas exigen sesión). */
export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get('/overview', getOverviewStats);
statsRouter.get('/streak', getStreakStats);
statsRouter.get('/effort', getEffortStats);
