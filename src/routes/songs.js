import { Router } from 'express';
import {
  listSongs,
  getSong,
  createSongFromLink,
  createSongFromUpload,
  audioUpload,
} from '../controllers/songController.js';
import { authMiddleware } from '../middleware/auth.js';

export const songsRouter = Router();

// Protected: catalog is only for signed-in users (adjust if you want public browse)
songsRouter.use(authMiddleware);

songsRouter.post('/from-link', createSongFromLink);
songsRouter.post(
  '/upload',
  (req, res, next) => {
    audioUpload.single('audio')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload thất bại' });
      next();
    });
  },
  createSongFromUpload
);

songsRouter.get('/', listSongs);
songsRouter.get('/:id', getSong);
