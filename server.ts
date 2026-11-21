import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addContribution,
  addExpense,
  addReimbursement,
  addTripMember,
  approveContribution,
  approveExpense,
  createTrip,
  deleteContribution,
  deleteExpense,
  deleteReimbursement,
  deleteTrip,
  getOrCreateUser,
  getTripDetail,
  listUserTrips,
  removeTripMember,
  seedSampleTripForUser,
  updateReimbursementStatus,
  updateTrip,
  updateTripMember,
  updateUserProfile,
  upsertSettlements,
} from './src/db/trips.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

function handleRouteError(res: express.Response, error: unknown) {
  const err = error as { statusCode?: number; message?: string };
  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  res.status(status).json({
    error: err.message || 'An unexpected server error occurred',
  });
}

function parsePositiveId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

async function resolveCurrentUser(req: AuthRequest) {
  const uid = req.user?.uid;
  const email = req.user?.email;
  const name = req.user?.name as string | undefined;
  if (!uid || !email) {
    throw Object.assign(new Error('Invalid authentication identity'), {
      statusCode: 401,
    });
  }
  return getOrCreateUser(uid, email, name);
}

app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await resolveCurrentUser(req);
    const trips = await listUserTrips(user.id);
    res.json({ user, trips });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.put('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await resolveCurrentUser(req);
    const { name, phone, defaultCurrency } = req.body ?? {};
    const updated = await updateUserProfile(user.id, {
      name: typeof name === 'string' ? name : undefined,
      phone: typeof phone === 'string' ? phone : undefined,
      defaultCurrency:
        typeof defaultCurrency === 'string' ? defaultCurrency : undefined,
    });
    res.json({ user: updated });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.get('/api/trips', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await resolveCurrentUser(req);
    const trips = await listUserTrips(user.id);
    res.json({ trips });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.post('/api/trips', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await resolveCurrentUser(req);
    const body = req.body ?? {};
    if (
      typeof body.tripName !== 'string' ||
      !body.tripName.trim() ||
      typeof body.destination !== 'string' ||
      !body.destination.trim() ||
      typeof body.startDate !== 'string' ||
      typeof body.endDate !== 'string'
    ) {
      res.status(400).json({ error: 'Trip name, destination, and dates are required' });
      return;
    }

    const tripId = await createTrip(user, {
      tripName: body.tripName,
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      currency: typeof body.currency === 'string' ? body.currency : user.defaultCurrency,
      defaultMemberBudget: Number(body.defaultMemberBudget || 0),
      refundPolicy: typeof body.refundPolicy === 'string' ? body.refundPolicy : 'proportional',
      coverImage: typeof body.coverImage === 'string' ? body.coverImage : undefined,
      members: Array.isArray(body.members) ? body.members : [],
    });

    res.status(201).json({ tripId });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.post('/api/trips/sample', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await resolveCurrentUser(req);
    const template =
      req.body?.template === 'sylhet' ? 'sylhet' : 'coxs-bazar';
    const tripId = await seedSampleTripForUser(
      user.id,
      user.name,
      user.email,
      template,
    );
    res.status(201).json({ tripId });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.get('/api/trips/:tripId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tripId = parsePositiveId(String(req.params.tripId));
    if (!tripId) {
      res.status(400).json({ error: 'Invalid trip ID' });
      return;
    }
    const user = await resolveCurrentUser(req);
    const detail = await getTripDetail(tripId, user.id);
    res.json(detail);
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.patch('/api/trips/:tripId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tripId = parsePositiveId(String(req.params.tripId));
    if (!tripId) {
      res.status(400).json({ error: 'Invalid trip ID' });
      return;
    }
    const user = await resolveCurrentUser(req);
    const trip = await updateTrip(tripId, user.id, req.body ?? {});
    res.json({ trip });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.delete('/api/trips/:tripId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tripId = parsePositiveId(String(req.params.tripId));
    if (!tripId) {
      res.status(400).json({ error: 'Invalid trip ID' });
      return;
    }
    const user = await resolveCurrentUser(req);
    await deleteTrip(tripId, user.id);
    res.json({ ok: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.post('/api/trips/:tripId/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tripId = parsePositiveId(String(req.params.tripId));
    if (!tripId) {
      res.status(400).json({ error: 'Invalid trip ID' });
      return;
    }
    const { memberName, memberEmail, assignedBudget, role } = req.body ?? {};
    if (
      typeof memberName !== 'string' ||
      !memberName.trim() ||
      typeof memberEmail !== 'string' ||
      !memberEmail.includes('@')
    ) {
      res.status(400).json({ error: 'Valid member name and email are required' });
      return;
    }
    const user = await resolveCurrentUser(req);
    const member = await addTripMember(tripId, user.id, {
      memberName,
      memberEmail,
      assignedBudget: Number(assignedBudget || 0),
      role: role === 'admin' ? 'admin' : 'member',
    });
    res.status(201).json({ member });
  } catch (error) {
    handleRouteError(res, error);
  }
});

app.patch(
  '/api/trips/:tripId/members/:memberId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const memberId = parsePositiveId(String(req.params.memberId));
      if (!tripId || !memberId) {
        res.status(400).json({ error: 'Invalid trip or member ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      const member = await updateTripMember(tripId, memberId, user.id, req.body ?? {});
      res.json({ member });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.delete(
  '/api/trips/:tripId/members/:memberId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const memberId = parsePositiveId(String(req.params.memberId));
      if (!tripId || !memberId) {
        res.status(400).json({ error: 'Invalid trip or member ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      await removeTripMember(tripId, memberId, user.id);
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.post(
  '/api/trips/:tripId/contributions',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      if (!tripId) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const { memberId, amount, contributionType, paymentDate, note } = req.body ?? {};
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({ error: 'Contribution amount must be greater than zero' });
        return;
      }
      const user = await resolveCurrentUser(req);
      const contribution = await addContribution(tripId, user.id, {
        memberId: Number(memberId),
        amount: parsedAmount,
        contributionType:
          contributionType === 'additional' ? 'additional' : 'initial',
        paymentDate:
          typeof paymentDate === 'string' && paymentDate
            ? paymentDate
            : new Date().toISOString().slice(0, 10),
        note: typeof note === 'string' ? note : '',
      });
      res.status(201).json({ contribution });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.patch(
  '/api/trips/:tripId/contributions/:contributionId/approve',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const contributionId = parsePositiveId(String(req.params.contributionId));
      if (!tripId || !contributionId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      const contribution = await approveContribution(
        tripId,
        contributionId,
        user.id,
      );
      res.json({ contribution });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.delete(
  '/api/trips/:tripId/contributions/:contributionId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const contributionId = parsePositiveId(String(req.params.contributionId));
      if (!tripId || !contributionId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      await deleteContribution(tripId, contributionId, user.id);
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.post(
  '/api/trips/:tripId/expenses',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      if (!tripId) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const {
        title,
        category,
        totalAmount,
        paidByMemberId,
        paymentSource,
        splitMethod,
        expenseDate,
        notes,
        participants,
        createReimbursement,
      } = req.body ?? {};

      const parsedTotal = Number(totalAmount);
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        !Number.isFinite(parsedTotal) ||
        parsedTotal <= 0 ||
        !Array.isArray(participants) ||
        participants.length === 0
      ) {
        res.status(400).json({
          error: 'Expense title, positive total amount, and at least one participant are required',
        });
        return;
      }

      const shareSum = participants.reduce(
        (s: number, p: { shareAmount?: number }) => s + Number(p.shareAmount || 0),
        0,
      );
      if (Math.abs(shareSum - parsedTotal) > 0.05) {
        res.status(400).json({
          error: `Participant shares (${shareSum.toFixed(2)}) must equal total expense (${parsedTotal.toFixed(2)})`,
        });
        return;
      }

      const user = await resolveCurrentUser(req);
      const expense = await addExpense(tripId, user.id, {
        title,
        category: typeof category === 'string' && category ? category : 'Other',
        totalAmount: parsedTotal,
        paidByMemberId: Number(paidByMemberId),
        paymentSource: paymentSource === 'personal' ? 'personal' : 'group_fund',
        splitMethod:
          splitMethod === 'custom'
            ? 'custom'
            : splitMethod === 'individual'
              ? 'individual'
              : 'equal',
        expenseDate:
          typeof expenseDate === 'string' && expenseDate
            ? expenseDate
            : new Date().toISOString().slice(0, 16),
        notes: typeof notes === 'string' ? notes : '',
        participants: participants.map(
          (p: { memberId: number; shareAmount: number }) => ({
            memberId: Number(p.memberId),
            shareAmount: Number(p.shareAmount),
          }),
        ),
        createReimbursement: Boolean(createReimbursement),
      });
      res.status(201).json({ expense });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.patch(
  '/api/trips/:tripId/expenses/:expenseId/approve',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const expenseId = parsePositiveId(String(req.params.expenseId));
      if (!tripId || !expenseId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      await approveExpense(tripId, expenseId, user.id);
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.delete(
  '/api/trips/:tripId/expenses/:expenseId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const expenseId = parsePositiveId(String(req.params.expenseId));
      if (!tripId || !expenseId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      await deleteExpense(tripId, expenseId, user.id);
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.post(
  '/api/trips/:tripId/reimbursements',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      if (!tripId) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const { memberId, amount, status, paymentDate, note } = req.body ?? {};
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({ error: 'Reimbursement amount must be positive' });
        return;
      }
      const user = await resolveCurrentUser(req);
      const reimbursement = await addReimbursement(tripId, user.id, {
        memberId: Number(memberId),
        amount: parsedAmount,
        status: status === 'completed' ? 'completed' : 'pending',
        paymentDate:
          typeof paymentDate === 'string' && paymentDate
            ? paymentDate
            : new Date().toISOString().slice(0, 10),
        note: typeof note === 'string' ? note : '',
      });
      res.status(201).json({ reimbursement });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.patch(
  '/api/trips/:tripId/reimbursements/:reimbursementId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const reimbursementId = parsePositiveId(
        String(req.params.reimbursementId),
      );
      if (!tripId || !reimbursementId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const { status, paymentDate } = req.body ?? {};
      const user = await resolveCurrentUser(req);
      const reimbursement = await updateReimbursementStatus(
        tripId,
        reimbursementId,
        user.id,
        status === 'completed' ? 'completed' : 'pending',
        typeof paymentDate === 'string' ? paymentDate : undefined,
      );
      res.json({ reimbursement });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.delete(
  '/api/trips/:tripId/reimbursements/:reimbursementId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      const reimbursementId = parsePositiveId(
        String(req.params.reimbursementId),
      );
      if (!tripId || !reimbursementId) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }
      const user = await resolveCurrentUser(req);
      await deleteReimbursement(tripId, reimbursementId, user.id);
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

app.post(
  '/api/trips/:tripId/settlements/finalize',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const tripId = parsePositiveId(String(req.params.tripId));
      if (!tripId) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const { entries, markTripCompleted } = req.body ?? {};
      if (!Array.isArray(entries)) {
        res.status(400).json({ error: 'Settlement entries array is required' });
        return;
      }
      const user = await resolveCurrentUser(req);
      const saved = await upsertSettlements(
        tripId,
        user.id,
        entries,
        Boolean(markTripCompleted),
      );
      res.json({ settlements: saved });
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.aistudio',
  'drizzle',
]);

const EXCLUDED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
]);

function addDirectoryToZip(zip: JSZip, rootDir: string, currentDir: string) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.resolve(currentDir, entry.name);
    if (!fullPath.startsWith(rootDir + path.sep)) continue;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      addDirectoryToZip(zip, rootDir, fullPath);
    } else if (entry.isFile()) {
      if (
        EXCLUDED_FILES.has(entry.name) ||
        entry.name.endsWith('.zip')
      ) {
        continue;
      }
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath);
      zip.file(relativePath, content);
    }
  }
}

app.get('/api/export-project-zip', async (_req, res) => {
  try {
    const zip = new JSZip();
    const rootDir = path.resolve(__dirname);
    addDirectoryToZip(zip, rootDir, rootDir);
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="tripmate-full-project.zip"',
    );
    res.send(buffer);
  } catch (error) {
    handleRouteError(res, error);
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '127.0.0.1', () => {
    console.log(`TripMate server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TripMate server:', err);
  process.exit(1);
});
