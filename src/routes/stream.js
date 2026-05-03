import { Router } from 'express';
import { streamSong, coverSong, streamMeta } from '../controllers/streamController.js';
import { authMiddleware } from '../middleware/auth.js';

export const streamRouter = Router();

streamRouter.use(authMiddleware);
streamRouter.get('/meta/:songId', streamMeta);
streamRouter.get('/cover/:songId', coverSong);
streamRouter.get('/:songId', streamSong);
