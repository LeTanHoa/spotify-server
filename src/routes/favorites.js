import { Router } from 'express';
import { listFavorites, addFavorite, removeFavorite } from '../controllers/favoritesController.js';
import { authMiddleware } from '../middleware/auth.js';

export const favoritesRouter = Router();

favoritesRouter.use(authMiddleware);
favoritesRouter.get('/', listFavorites);
favoritesRouter.post('/', addFavorite);
favoritesRouter.delete('/:songId', removeFavorite);
