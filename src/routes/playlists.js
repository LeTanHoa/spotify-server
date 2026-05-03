import { Router } from 'express';
import {
  createPlaylist,
  addSongToPlaylist,
  getPlaylist,
  listMyPlaylists,
} from '../controllers/playlistController.js';
import { authMiddleware } from '../middleware/auth.js';

export const playlistsRouter = Router();

playlistsRouter.use(authMiddleware);
playlistsRouter.get('/', listMyPlaylists);
playlistsRouter.post('/', createPlaylist);
playlistsRouter.post('/add-song', addSongToPlaylist);
playlistsRouter.get('/:id', getPlaylist);
