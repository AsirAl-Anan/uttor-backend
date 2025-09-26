// routes/hub.routes.js
import express from 'express';
import { authenTicateSession } from '../middlewares/auth.js';
import { configurations, handleMulterError } from '../utils/multer.js';
import { 
    createDoubtController, 
    voteDoubtController,
    getAllDoubtsController,
    // --- NEW IMPORTS ---
    getDoubtByIdController,
    postAnswerController,
    voteAnswerController,
    postReplyController
} from '../controllers/hub.controller.js';
import { noCache } from '../middlewares/cache.middleware.js';
const router = express.Router();

router.use(authenTicateSession);

// --- Doubt Routes ---
router.get('/doubts',noCache, getAllDoubtsController);
router.post('/doubts', configurations.fields, handleMulterError, createDoubtController);
router.get('/doubts/:doubtId',noCache, getDoubtByIdController); // NEW
router.post('/doubts/:doubtId/vote', voteDoubtController);
router.post('/doubts/:doubtId/answers', configurations.fields, handleMulterError, postAnswerController);
router.post('/answers/:answerId/replies', configurations.fields, handleMulterError, postReplyController); 

// --- Answer Routes ---
router.post('/answers/:answerId/vote', voteAnswerController); // NEW

export default router;