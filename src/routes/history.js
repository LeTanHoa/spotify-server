import { Router } from 'express';
import { recent, recommend, recordPlay } from '../controllers/historyController.js';
import { authMiddleware } from '../middleware/auth.js';

export const historyRouter = Router();

historyRouter.use(authMiddleware);
historyRouter.get('/recent', recent);
historyRouter.get('/recommend', recommend);
historyRouter.post('/play', recordPlay);
