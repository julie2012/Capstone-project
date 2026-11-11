const crypto = require('node:crypto');
const admin = require('firebase-admin');

const DATABASE_URL = 'https://stajusta-entrance-exam-default-rtdb.asia-southeast1.firebasedatabase.app';
const ALLOWED_ORIGINS = new Set([
    'https://capstoneproject-ten-rho.vercel.app',
    'http://localhost',
    'http://localhost:8080',
    'http://127.0.0.1',
    'http://127.0.0.1:8080'
]);
const SUBJECTS = ['math', 'science', 'english'];

function getDatabase() {
    if (!admin.apps.length) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccount) {
            const error = new Error('The server is missing its Firebase service account configuration.');
            error.status = 500;
            error.code = 'SERVER_CONFIGURATION';
            throw error;
        }

        let credential;
        try {
            credential = JSON.parse(serviceAccount);
        } catch (parseError) {
            const error = new Error('The Firebase service account configuration is not valid JSON.');
            error.status = 500;
            error.code = 'SERVER_CONFIGURATION';
            throw error;
        }

        admin.initializeApp({
            credential: admin.credential.cert(credential),
            databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL
        });
    }
    return admin.database();
}

function apiError(status, code, message, details = {}) {
    return Object.assign(new Error(message), { status, code, details });
}

function readLrn(value) {
    const lrn = String(value || '').trim();
    if (!/^\d{12}$/.test(lrn)) {
        throw apiError(400, 'INVALID_LRN', 'Enter a valid 12-digit LRN.');
    }
    return lrn;
}

function normalizeProgress(student) {
    return {
        completed_subjects: Object.assign({ math: false, science: false, english: false }, student.completed_subjects || {}),
        subject_scores: Object.assign({ math: 0, science: 0, english: 0 }, student.subject_scores || {})
    };
}

function getTargetLevel(student) {
    const gradeLevel = student.grade_level || '';
    const program = student.program || student.track || 'Regular';
    return {
        gradeLevel,
        program,
        questionLevel: gradeLevel === 'Grade 7' && program === 'STE' ? 'Grade 7 STE' : gradeLevel
    };
}

function buildQuestionsBySubject(rawQuestions) {
    const questions = { math: [], science: [], english: [] };
    const answerKeys = { math: {}, science: {}, english: {} };

    Object.entries(rawQuestions || {}).forEach(([subjectName, subjectQuestions]) => {
        const subject = subjectName.toLowerCase();
        if (!SUBJECTS.includes(subject) || !subjectQuestions || typeof subjectQuestions !== 'object') return;

        Object.entries(subjectQuestions).forEach(([id, question]) => {
            if (!question || !question.text || !question.options) return;
            const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[String(question.correct || '').toUpperCase()];
            if (correctIndex === undefined) return;

            questions[subject].push({
                id,
                q: String(question.text),
                options: ['A', 'B', 'C', 'D'].map(letter => `${letter}) ${question.options[letter] ?? ''}`)
            });
            answerKeys[subject][id] = correctIndex;
        });

        questions[subject].sort(() => Math.random() - 0.5);
    });

    return { questions, answerKeys };
}

async function startExam(db, lrn) {
    const studentRef = db.ref(`students/${lrn}`);
    const snapshot = await studentRef.get();
    if (!snapshot.exists()) throw apiError(404, 'STUDENT_NOT_FOUND', 'No student record was found for that LRN.');

    const student = snapshot.val() || {};
    if (student.exam_score_raw !== undefined || student.exam_status === 'Exam Completed') {
        throw apiError(409, 'EXAM_COMPLETED', 'This student has already completed the exam.');
    }
    if (!['Qualified for Exam', 'Taking Exam'].includes(student.exam_status)) {
        throw apiError(403, 'NOT_APPROVED', 'This student has not been approved to take the exam.', {
            examStatus: student.exam_status || 'Pending Verification'
        });
    }

    const { gradeLevel, program, questionLevel } = getTargetLevel(student);
    if (!gradeLevel || !questionLevel) throw apiError(400, 'GRADE_LEVEL_MISSING', 'The student record is missing a grade level.');

    if (student.exam_status !== 'Taking Exam') {
        const rulesSnapshot = await db.ref(`placement_rules/${program}`).get();
        const capacity = Math.max(1, parseInt(rulesSnapshot.val()?.capacity, 10) || 40);
        const studentsSnapshot = await db.ref('students').get();
        const students = studentsSnapshot.val() || {};
        const activeExaminees = Object.entries(students).filter(([studentLrn, record]) =>
            studentLrn !== lrn &&
            (record.program === program || record.track === program) &&
            record.exam_status === 'Taking Exam'
        ).length;

        if (activeExaminees >= capacity) {
            throw apiError(429, 'QUEUE_FULL', 'Exam slots are full. Please wait and try again.', { activeExaminees, capacity });
        }
    }

    const questionsSnapshot = await db.ref(`questions/${questionLevel}`).get();
    if (!questionsSnapshot.exists()) throw apiError(404, 'QUESTIONS_MISSING', `No questions are configured for ${questionLevel}.`);
    const { questions, answerKeys } = buildQuestionsBySubject(questionsSnapshot.val());
    if (!SUBJECTS.some(subject => questions[subject].length)) {
        throw apiError(404, 'QUESTIONS_MISSING', `No recognized questions are configured for ${questionLevel}.`);
    }

    const progress = normalizeProgress(student);
    await studentRef.update({
        exam_status: 'Taking Exam',
        completed_subjects: progress.completed_subjects,
        subject_scores: progress.subject_scores
    });

    const sessionId = crypto.randomUUID();
    await db.ref(`exam_sessions/${lrn}`).set({
        session_id: sessionId,
        started_at: Date.now(),
        answer_keys: answerKeys,
        questions: Object.fromEntries(SUBJECTS.map(subject => [subject, questions[subject].map(q => q.id)])),
        submissions: {}
    });

    return {
        sessionId,
        targetLevel: questionLevel,
        student: {
            fullname: student.fullname || student.fullName || student.name || `${student.firstname || ''} ${student.lastname || ''}`.trim() || 'Student',
            grade_level: gradeLevel,
            exam_status: 'Taking Exam',
            ...progress
        },
        questions
    };
}

async function submitSubject(db, lrn, body) {
    const subject = String(body.subject || '').toLowerCase();
    if (!SUBJECTS.includes(subject)) throw apiError(400, 'INVALID_SUBJECT', 'Unknown exam subject.');
    if (!Array.isArray(body.answers)) throw apiError(400, 'INVALID_ANSWERS', 'Answer data is missing.');

    const sessionRef = db.ref(`exam_sessions/${lrn}`);
    const [sessionSnapshot, studentSnapshot] = await Promise.all([
        sessionRef.get(), db.ref(`students/${lrn}`).get()
    ]);
    const session = sessionSnapshot.val();
    const student = studentSnapshot.val();
    if (!session || session.session_id !== body.sessionId) throw apiError(403, 'SESSION_EXPIRED', 'The exam session has expired. Start again using the LRN.');
    if (!student || student.exam_status !== 'Taking Exam') throw apiError(403, 'EXAM_NOT_ACTIVE', 'There is no active exam for this student.');

    const questionIds = session.questions?.[subject] || [];
    if (body.answers.length !== questionIds.length) throw apiError(400, 'INVALID_ANSWERS', 'The submitted answer list does not match this module.');
    const submissions = session.submissions || {};
    const existing = submissions[subject];
    if (existing) {
        const sameAnswers = JSON.stringify(existing.answers) === JSON.stringify(body.answers);
        if (!sameAnswers) throw apiError(409, 'SUBJECT_ALREADY_SUBMITTED', 'This subject has already been submitted.');
        return { score: existing.score, maximum: existing.maximum, progress: normalizeProgress(student) };
    }

    if (student.completed_subjects?.[subject]) {
        throw apiError(409, 'SUBJECT_ALREADY_SUBMITTED', 'This subject is already marked complete.');
    }

    let score = 0;
    body.answers.forEach((answer, index) => {
        if (answer !== null && answer !== undefined && (!Number.isInteger(answer) || answer < 0 || answer > 3)) {
            throw apiError(400, 'INVALID_ANSWERS', 'One or more selected answers are invalid.');
        }
        const questionId = questionIds[index];
        if (answer !== null && answer !== undefined && session.answer_keys?.[subject]?.[questionId] === answer) score++;
    });

    const progress = normalizeProgress(student);
    progress.subject_scores[subject] = score;
    progress.completed_subjects[subject] = true;
    submissions[subject] = { answers: body.answers, score, maximum: questionIds.length };

    await Promise.all([
        db.ref(`students/${lrn}`).update({
            subject_scores: progress.subject_scores,
            completed_subjects: progress.completed_subjects
        }),
        sessionRef.update({ submissions })
    ]);
    return { score, maximum: questionIds.length, progress };
}

async function finalizeExam(db, lrn, body) {
    const sessionRef = db.ref(`exam_sessions/${lrn}`);
    const [sessionSnapshot, studentSnapshot, rulesSnapshot] = await Promise.all([
        sessionRef.get(), db.ref(`students/${lrn}`).get(), db.ref('placement_rules').get()
    ]);
    const session = sessionSnapshot.val();
    const student = studentSnapshot.val();
    if (!session || session.session_id !== body.sessionId) throw apiError(403, 'SESSION_EXPIRED', 'The exam session has expired. Start again using the LRN.');
    if (!student || student.exam_status !== 'Taking Exam') throw apiError(403, 'EXAM_NOT_ACTIVE', 'There is no active exam for this student.');
    if (!SUBJECTS.every(subject => student.completed_subjects?.[subject])) {
        throw apiError(409, 'EXAM_INCOMPLETE', 'Complete all three subjects before final submission.');
    }

    const progress = normalizeProgress(student);
    const totals = Object.fromEntries(SUBJECTS.map(subject => [subject, {
        score: Number(progress.subject_scores[subject]) || 0,
        maximum: (session.questions?.[subject] || []).length
    }]));
    const totalRaw = SUBJECTS.reduce((sum, subject) => sum + totals[subject].score, 0);
    const totalMaximum = SUBJECTS.reduce((sum, subject) => sum + totals[subject].maximum, 0);
    const examPercentage = totalMaximum > 0 ? (totalRaw / totalMaximum) * 100 : 0;
    const gwa = parseFloat(student.gwa) || 75;
    const aiPlacementRating = (gwa * 0.6) + (examPercentage * 0.4);
    const rules = rulesSnapshot.val() || {};
    let recommendedTrack = 'Regular Section';

    if (student.grade_level === 'Grade 11') {
        const strands = ['STEM', 'ICT', 'EIM', 'SMAW']
            .filter(name => rules[name])
            .map(name => ({ name, threshold: parseFloat(rules[name].threshold) || 0 }))
            .sort((a, b) => b.threshold - a.threshold);
        recommendedTrack = 'GAS / Regular';
        const match = strands.find(strand => aiPlacementRating >= strand.threshold);
        if (match) recommendedTrack = match.name;
    } else {
        const steThreshold = rules.STE ? (parseFloat(rules.STE.threshold) || 0) : 85;
        if (aiPlacementRating >= steThreshold) recommendedTrack = 'STE';
    }

    await db.ref(`students/${lrn}`).update({
        exam_score_raw: totalRaw,
        exam_score_percent: examPercentage,
        ai_placement_rating: aiPlacementRating.toFixed(2),
        exam_status: 'Exam Completed',
        track: recommendedTrack,
        program: recommendedTrack
    });
    await sessionRef.remove();

    return {
        studentName: student.fullname || student.fullName || student.name || `${student.firstname || ''} ${student.lastname || ''}`.trim() || 'Student',
        totals,
        totalRaw,
        totalMaximum,
        examPercentage,
        aiPlacementRating: aiPlacementRating.toFixed(2),
        recommendedTrack
    };
}

module.exports = async function handler(req, res) {
    const origin = req.headers.origin;
    let isSameOrigin = false;
    try {
        isSameOrigin = Boolean(origin) && new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
    } catch (_) {
        isSameOrigin = false;
    }
    if (origin && !isSameOrigin && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ error: 'Origin not allowed.', code: 'ORIGIN_NOT_ALLOWED' });
    }
    if (origin && !isSameOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST for exam requests.', code: 'METHOD_NOT_ALLOWED' });

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const lrn = readLrn(body.lrn);
        const db = getDatabase();
        let result;

        if (body.action === 'start') result = await startExam(db, lrn);
        else if (body.action === 'submitSubject') result = await submitSubject(db, lrn, body);
        else if (body.action === 'finalize') result = await finalizeExam(db, lrn, body);
        else throw apiError(400, 'INVALID_ACTION', 'Unknown exam action.');

        return res.status(200).json({ ok: true, ...result });
    } catch (error) {
        const status = error.status || 500;
        const code = error.code || 'EXAM_API_ERROR';
        console.error('Exam API request failed:', { status, code });
        return res.status(status).json({
            ok: false,
            code,
            error: status === 500 ? 'The exam service could not complete the request.' : error.message,
            details: error.details || undefined
        });
    }
};
