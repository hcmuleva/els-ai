import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { closeDb } from '@els-ai/db-runtime';
import { authRouter } from './services/auth/routes/auth.js';
import { usersRouter } from './services/auth/routes/users.js';
import { studentsRouter as authStudentsRouter } from './services/auth/routes/students.js';
import { counselingRouter } from './services/auth/routes/counseling.js';
import { feedbackRouter } from './services/auth/routes/feedback.js';
import { billingRouter } from './services/auth/routes/billing.js';
import { organizationsRouter } from './services/org/routes/organizations.js';
import { topicsRouter, catalogRouter, studentsRouter as topicStudentsRouter, } from './services/topic/routes/topics.js';
import { contentRouter } from './services/content/routes/content.js';
import { videoContentRouter, videoSectionsRouter, } from './services/content/routes/video-sections.js';
import { bookmarksRouter } from './services/content/routes/bookmarks.js';
import { questionsRouter, questionBankRouter, } from './services/question-bank/routes/questions.js';
import { quizzesRouter } from './services/quiz/routes/quizzes.js';
import { classroomsRouter } from './services/classroom/routes/classrooms.js';
import { assignmentsRouter } from './services/assignment/routes/assignments.js';
import { achievementsRouter } from './services/achievement/routes/achievements.js';
import { storiesRouter } from './services/story/routes/stories.js';
import { notificationsRouter } from './services/notification/routes/notifications.js';
import { preferencesRouter } from './services/notification/routes/preferences.js';
import { tokenRouter } from './services/notification/routes/token.js';
config();
const PORT = Number(process.env.PORT || 4020);
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'els-core-api' });
});
app.get('/livez', (_req, res) => {
    res.json({ status: 'ok', service: 'els-core-api' });
});
app.get('/readyz', (_req, res) => {
    res.json({ status: 'ready', service: 'els-core-api' });
});
// Identity and organization
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/students', authStudentsRouter);
app.use('/counseling', counselingRouter);
app.use('/feedback', feedbackRouter);
app.use('/billing', billingRouter);
app.use('/organizations', organizationsRouter);
// Learning catalog and content
app.use('/topics', topicsRouter);
app.use('/catalog/subjects', catalogRouter);
app.use('/students/subjects', topicStudentsRouter);
app.use('/content', contentRouter);
app.use('/content', videoContentRouter);
app.use('/video-sections', videoSectionsRouter);
app.use('/bookmarks', bookmarksRouter);
// Assessment and classroom operations
app.use('/questions', questionsRouter);
app.use('/question-bank', questionBankRouter);
app.use('/quizzes', quizzesRouter);
app.use('/classrooms', classroomsRouter);
app.use('/assignments', assignmentsRouter);
app.use('/achievements', achievementsRouter);
app.use('/stories', storiesRouter);
// Notifications
app.use('/notifications/preferences', preferencesRouter);
app.use('/notifications/ably-token', tokenRouter);
app.use('/notifications', notificationsRouter);
app.use((error, _req, res, _next) => {
    console.error('[els-core-api] unhandled request error', error);
    res.status(500).json({ message: 'Internal server error' });
});
const server = app.listen(PORT, () => {
    console.log(`ELS Core API listening on port ${PORT}`);
});
function shutdown(signal) {
    console.log(`[els-core-api] received ${signal}, shutting down`);
    server.close(() => {
        void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
//# sourceMappingURL=server.js.map