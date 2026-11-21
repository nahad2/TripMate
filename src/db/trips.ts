import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { computeTripFinancials } from '../lib/calculations.ts';
import type {
  ContributionRecord,
  ExpenseParticipantRecord,
  ExpenseRecord,
  MemberRole,
  ReimbursementRecord,
  SettlementRecord,
  TripDetailPayload,
  TripListItem,
  TripMemberRecord,
  TripRecord,
  UserProfile,
} from '../lib/tripmate-types.ts';
import { db } from './index.ts';
import {
  contributions,
  expenseParticipants,
  expenses,
  reimbursements,
  settlements,
  tripMembers,
  trips,
  users,
} from './schema.ts';

function sanitizeDbError(context: string, error: unknown): Error {
  console.error(`[DB] ${context}:`, error);
  return new Error(`${context}. Please try again later.`, { cause: error });
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
): Promise<UserProfile> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const fallbackName =
      displayName && displayName.trim().length > 0
        ? displayName.trim()
        : cleanEmail.split('@')[0] || 'Traveler';

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    let userRow: typeof users.$inferSelect;
    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({ email: cleanEmail })
        .where(eq(users.uid, uid))
        .returning();
      userRow = updated[0];
    } else {
      const inserted = await db
        .insert(users)
        .values({
          uid,
          email: cleanEmail,
          name: fallbackName,
          phone: '',
          defaultCurrency: 'BDT',
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email: cleanEmail },
        })
        .returning();
      userRow = inserted[0];
    }

    // Link any trip invitations matching this user's email
    await db
      .update(tripMembers)
      .set({ userId: userRow.id })
      .where(
        and(
          sql`lower(${tripMembers.memberEmail}) = ${cleanEmail}`,
          isNull(tripMembers.userId),
        ),
      );

    // Seed an initial sample trip on very first account creation if user has 0 trips
    const existingTrips = await db
      .select({ id: tripMembers.id })
      .from(tripMembers)
      .where(eq(tripMembers.userId, userRow.id))
      .limit(1);

    if (existingTrips.length === 0 && existing.length === 0) {
      await seedSampleTripForUser(userRow.id, userRow.name, userRow.email, 'coxs-bazar');
    }

    return {
      id: userRow.id,
      uid: userRow.uid,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone ?? '',
      defaultCurrency: userRow.defaultCurrency,
    };
  } catch (error) {
    throw sanitizeDbError('Failed to initialize user profile', error);
  }
}

export async function updateUserProfile(
  userId: number,
  input: { name?: string; phone?: string; defaultCurrency?: string },
): Promise<UserProfile> {
  try {
    const updatePayload: Partial<typeof users.$inferInsert> = {};
    if (input.name !== undefined && input.name.trim().length > 0) {
      updatePayload.name = input.name.trim();
    }
    if (input.phone !== undefined) {
      updatePayload.phone = input.phone.trim();
    }
    if (input.defaultCurrency !== undefined && input.defaultCurrency.trim().length > 0) {
      updatePayload.defaultCurrency = input.defaultCurrency.trim().toUpperCase();
    }

    const updated = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new Error('User profile not found');
    }

    const row = updated[0];
    if (updatePayload.name) {
      await db
        .update(tripMembers)
        .set({ memberName: updatePayload.name })
        .where(eq(tripMembers.userId, userId));
    }

    return {
      id: row.id,
      uid: row.uid,
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      defaultCurrency: row.defaultCurrency,
    };
  } catch (error) {
    throw sanitizeDbError('Failed to update user profile', error);
  }
}

export async function seedSampleTripForUser(
  userId: number,
  userName: string,
  userEmail: string,
  template: 'coxs-bazar' | 'sylhet' = 'coxs-bazar',
): Promise<number> {
  try {
    const isSylhet = template === 'sylhet';
    return await db.transaction(async (tx) => {
      const [trip] = await tx
        .insert(trips)
        .values({
          tripName: isSylhet
            ? 'Sylhet Tea Valley Expedition'
            : "Cox's Bazar Coastal Retreat",
          destination: isSylhet ? 'Sylhet & Sreemangal' : "Cox's Bazar, Marine Drive",
          startDate: isSylhet ? '2026-12-04' : '2026-11-12',
          endDate: isSylhet ? '2026-12-07' : '2026-11-15',
          currency: 'BDT',
          defaultMemberBudget: isSylhet ? 3500 : 2500,
          status: isSylhet ? 'upcoming' : 'ongoing',
          refundPolicy: 'proportional',
          coverImage: isSylhet
            ? '/src/assets/images/trip_highlands_retreat_1795201698377.jpg'
            : '/src/assets/images/trip_coastal_island_1795201698982.jpg',
          createdByUserId: userId,
        })
        .returning();

      const memberBudget = isSylhet ? 3500 : 2500;
      const insertedMembers = await tx
        .insert(tripMembers)
        .values([
          {
            tripId: trip.id,
            userId,
            memberName: userName,
            memberEmail: userEmail,
            assignedBudget: memberBudget,
            role: 'admin',
          },
          {
            tripId: trip.id,
            userId: null,
            memberName: 'Rafiq Hasan',
            memberEmail: 'rafiq.hasan@example.com',
            assignedBudget: memberBudget,
            role: 'member',
          },
          {
            tripId: trip.id,
            userId: null,
            memberName: 'Tasnim Rahman',
            memberEmail: 'tasnim.rahman@example.com',
            assignedBudget: memberBudget,
            role: 'member',
          },
          {
            tripId: trip.id,
            userId: null,
            memberName: 'Farhan Kabir',
            memberEmail: 'farhan.kabir@example.com',
            assignedBudget: memberBudget,
            role: 'member',
          },
          {
            tripId: trip.id,
            userId: null,
            memberName: 'Nadia Chowdhury',
            memberEmail: 'nadia.c@example.com',
            assignedBudget: memberBudget,
            role: 'member',
          },
        ])
        .returning();

      const [mAdmin, mRafiq, mTasnim, mFarhan, mNadia] = insertedMembers;

      if (isSylhet) {
        await tx.insert(contributions).values([
          {
            tripId: trip.id,
            memberId: mAdmin.id,
            amount: 3500,
            contributionType: 'initial',
            paymentDate: '2026-11-18',
            note: 'Initial pool deposit',
            approvalStatus: 'approved',
          },
          {
            tripId: trip.id,
            memberId: mRafiq.id,
            amount: 3500,
            contributionType: 'initial',
            paymentDate: '2026-11-19',
            note: 'bKash transfer',
            approvalStatus: 'approved',
          },
          {
            tripId: trip.id,
            memberId: mTasnim.id,
            amount: 2000,
            contributionType: 'initial',
            paymentDate: '2026-11-19',
            note: 'Partial advance; balance at station',
            approvalStatus: 'approved',
          },
        ]);

        const [exp1] = await tx
          .insert(expenses)
          .values({
            tripId: trip.id,
            title: 'Eco-Resort Cottage Advance Booking',
            category: 'Accommodation',
            totalAmount: 5500,
            paidByMemberId: mAdmin.id,
            paymentSource: 'group_fund',
            splitMethod: 'equal',
            expenseDate: '2026-11-19T15:30',
            notes: '2 valley-view cottages reserved for 3 nights',
            approvalStatus: 'approved',
          })
          .returning();

        await tx.insert(expenseParticipants).values(
          insertedMembers.map((m) => ({
            expenseId: exp1.id,
            memberId: m.id,
            shareAmount: 1100,
          })),
        );

        return trip.id;
      }

      // Cox's Bazar sample financial activity
      await tx.insert(contributions).values([
        {
          tripId: trip.id,
          memberId: mAdmin.id,
          amount: 2500,
          contributionType: 'initial',
          paymentDate: '2026-11-10',
          note: 'Initial trip budget deposit',
          approvalStatus: 'approved',
        },
        {
          tripId: trip.id,
          memberId: mRafiq.id,
          amount: 2500,
          contributionType: 'initial',
          paymentDate: '2026-11-10',
          note: 'Initial deposit via bank transfer',
          approvalStatus: 'approved',
        },
        {
          tripId: trip.id,
          memberId: mTasnim.id,
          amount: 2500,
          contributionType: 'initial',
          paymentDate: '2026-11-11',
          note: 'Initial deposit cash',
          approvalStatus: 'approved',
        },
        {
          tripId: trip.id,
          memberId: mFarhan.id,
          amount: 1500,
          contributionType: 'initial',
          paymentDate: '2026-11-11',
          note: 'Partial initial payment (1,000 BDT pending)',
          approvalStatus: 'approved',
        },
        {
          tripId: trip.id,
          memberId: mNadia.id,
          amount: 2500,
          contributionType: 'initial',
          paymentDate: '2026-11-12',
          note: 'Initial deposit at departure',
          approvalStatus: 'approved',
        },
        {
          tripId: trip.id,
          memberId: mAdmin.id,
          amount: 500,
          contributionType: 'additional',
          paymentDate: '2026-11-13',
          note: 'Top-up for Inani Beach jeep charter',
          approvalStatus: 'approved',
        },
        {
          tripId: trip.id,
          memberId: mRafiq.id,
          amount: 500,
          contributionType: 'additional',
          paymentDate: '2026-11-13',
          note: 'Top-up for Inani Beach jeep charter',
          approvalStatus: 'approved',
        },
      ]);

      // Expense 1: Group fund equal split across all 5
      const [exp1] = await tx
        .insert(expenses)
        .values({
          tripId: trip.id,
          title: 'AC Sleeper Coach Tickets (Round Trip)',
          category: 'Transportation',
          totalAmount: 4500,
          paidByMemberId: mAdmin.id,
          paymentSource: 'group_fund',
          splitMethod: 'equal',
          expenseDate: '2026-11-12T08:15',
          notes: '5 highway sleeper seats booked together',
          approvalStatus: 'approved',
        })
        .returning();
      await tx.insert(expenseParticipants).values(
        insertedMembers.map((m) => ({
          expenseId: exp1.id,
          memberId: m.id,
          shareAmount: 900,
        })),
      );

      // Expense 2: Group fund equal split across all 5
      const [exp2] = await tx
        .insert(expenses)
        .values({
          tripId: trip.id,
          title: 'Sea Pearl Suite Hotel (2 Nights)',
          category: 'Accommodation',
          totalAmount: 4000,
          paidByMemberId: mAdmin.id,
          paymentSource: 'group_fund',
          splitMethod: 'equal',
          expenseDate: '2026-11-12T14:00',
          notes: 'Two connecting oceanfront rooms',
          approvalStatus: 'approved',
        })
        .returning();
      await tx.insert(expenseParticipants).values(
        insertedMembers.map((m) => ({
          expenseId: exp2.id,
          memberId: m.id,
          shareAmount: 800,
        })),
      );

      // Expense 3: Personal payment by Rafiq, non-participating member (Nadia skipped seafood dinner)
      const [exp3] = await tx
        .insert(expenses)
        .values({
          tripId: trip.id,
          title: 'Marine Drive Seafood Dinner',
          category: 'Meals',
          totalAmount: 1600,
          paidByMemberId: mRafiq.id,
          paymentSource: 'personal',
          splitMethod: 'equal',
          expenseDate: '2026-11-13T20:30',
          notes: 'Rafiq paid from personal card; Nadia dined separately',
          approvalStatus: 'approved',
        })
        .returning();
      await tx.insert(expenseParticipants).values(
        [mAdmin, mRafiq, mTasnim, mFarhan].map((m) => ({
          expenseId: exp3.id,
          memberId: m.id,
          shareAmount: 400,
        })),
      );

      // Expense 4: Custom split for Parasailing & Kayaking (only 3 members participated with different activities)
      const [exp4] = await tx
        .insert(expenses)
        .values({
          tripId: trip.id,
          title: 'Inani Parasailing & Kayak Rentals',
          category: 'Tickets & Entrance Fees',
          totalAmount: 1450,
          paidByMemberId: mTasnim.id,
          paymentSource: 'personal',
          splitMethod: 'custom',
          expenseDate: '2026-11-14T11:20',
          notes: 'Tasnim & Farhan parasailed (600 each); Nadia kayaked (250)',
          approvalStatus: 'approved',
        })
        .returning();
      await tx.insert(expenseParticipants).values([
        { expenseId: exp4.id, memberId: mTasnim.id, shareAmount: 600 },
        { expenseId: exp4.id, memberId: mFarhan.id, shareAmount: 600 },
        { expenseId: exp4.id, memberId: mNadia.id, shareAmount: 250 },
      ]);

      // Expense 5: Group fund snacks
      const [exp5] = await tx
        .insert(expenses)
        .values({
          tripId: trip.id,
          title: 'Himchari Tea & Beach Snacks',
          category: 'Snacks',
          totalAmount: 450,
          paidByMemberId: mAdmin.id,
          paymentSource: 'group_fund',
          splitMethod: 'equal',
          expenseDate: '2026-11-14T16:45',
          notes: 'Coconut water and sunset snacks for everyone',
          approvalStatus: 'approved',
        })
        .returning();
      await tx.insert(expenseParticipants).values(
        insertedMembers.map((m) => ({
          expenseId: exp5.id,
          memberId: m.id,
          shareAmount: 90,
        })),
      );

      // Reimbursement: Rafiq already reimbursed 1000 BDT, Tasnim has pending 1450 BDT reimbursement
      await tx.insert(reimbursements).values([
        {
          tripId: trip.id,
          memberId: mRafiq.id,
          amount: 1000,
          status: 'completed',
          paymentSource: 'group_fund',
          paymentDate: '2026-11-14',
          note: 'Partial advance return for Marine Drive dinner',
        },
        {
          tripId: trip.id,
          memberId: mTasnim.id,
          amount: 1450,
          status: 'pending',
          paymentSource: 'group_fund',
          paymentDate: '2026-11-14',
          note: 'Personal card payment for Inani water activities',
        },
      ]);

      return trip.id;
    });
  } catch (error) {
    throw sanitizeDbError('Failed to create sample trip', error);
  }
}

export async function listUserTrips(userId: number): Promise<TripListItem[]> {
  try {
    const memberships = await db
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.userId, userId));

    if (memberships.length === 0) return [];

    const tripIds = Array.from(new Set(memberships.map((m) => m.tripId)));

    const tripRows = await db
      .select()
      .from(trips)
      .where(inArray(trips.id, tripIds))
      .orderBy(desc(trips.createdAt));

    const allMembers = await db
      .select()
      .from(tripMembers)
      .where(inArray(tripMembers.tripId, tripIds));

    const allContribs = await db
      .select()
      .from(contributions)
      .where(inArray(contributions.tripId, tripIds));

    const allExpenses = await db
      .select()
      .from(expenses)
      .where(inArray(expenses.tripId, tripIds));

    const allReimb = await db
      .select()
      .from(reimbursements)
      .where(inArray(reimbursements.tripId, tripIds));

    const allSettle = await db
      .select()
      .from(settlements)
      .where(inArray(settlements.tripId, tripIds));

    return tripRows.map((trip) => {
      const tMembers = allMembers
        .filter((m) => m.tripId === trip.id)
        .map(mapMember);
      const tContribs = allContribs
        .filter((c) => c.tripId === trip.id)
        .map(mapContribution);
      const tExpenses = allExpenses
        .filter((e) => e.tripId === trip.id)
        .map((e) => ({
          ...mapExpense(e),
          participants: [],
        }));
      const tReimb = allReimb
        .filter((r) => r.tripId === trip.id)
        .map(mapReimbursement);
      const tSettle = allSettle
        .filter((s) => s.tripId === trip.id)
        .map(mapSettlement);

      const overview = computeTripFinancials(
        tMembers,
        tContribs,
        tExpenses,
        tReimb,
        tSettle,
      );

      const myMembership = memberships.find((m) => m.tripId === trip.id);
      const myRole: MemberRole =
        myMembership?.role === 'admin' || trip.createdByUserId === userId
          ? 'admin'
          : 'member';

      return {
        ...mapTrip(trip),
        memberCount: tMembers.length,
        myRole,
        totalCollected: overview.totalCollectedMoney,
        totalExpenses: overview.totalTripExpense,
        remainingFund: overview.remainingGroupFund,
      };
    });
  } catch (error) {
    throw sanitizeDbError('Failed to list trips', error);
  }
}

export async function assertTripMembership(
  tripId: number,
  userId: number,
  requireAdmin = false,
): Promise<{ trip: TripRecord; myRole: MemberRole; myMemberId: number | null }> {
  const tripRows = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (tripRows.length === 0) {
    throw Object.assign(new Error('Trip not found'), { statusCode: 404 });
  }
  const trip = tripRows[0];

  const memberRows = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
    .limit(1);

  const isCreator = trip.createdByUserId === userId;
  if (memberRows.length === 0 && !isCreator) {
    throw Object.assign(new Error('Forbidden: You do not belong to this trip'), {
      statusCode: 403,
    });
  }

  const myRole: MemberRole =
    isCreator || memberRows[0]?.role === 'admin' ? 'admin' : 'member';

  if (requireAdmin && myRole !== 'admin') {
    throw Object.assign(
      new Error('Forbidden: Trip Administrator access required'),
      { statusCode: 403 },
    );
  }

  return {
    trip: mapTrip(trip),
    myRole,
    myMemberId: memberRows[0]?.id ?? null,
  };
}

export async function getTripDetail(
  tripId: number,
  userId: number,
): Promise<TripDetailPayload> {
  try {
    const access = await assertTripMembership(tripId, userId, false);

    const memberRows = await db
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.tripId, tripId))
      .orderBy(asc(tripMembers.id));

    const contribRows = await db
      .select()
      .from(contributions)
      .where(eq(contributions.tripId, tripId))
      .orderBy(desc(contributions.paymentDate), desc(contributions.id));

    const expenseRows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.tripId, tripId))
      .orderBy(desc(expenses.expenseDate), desc(expenses.id));

    const expenseIds = expenseRows.map((e) => e.id);
    const participantRows =
      expenseIds.length > 0
        ? await db
            .select()
            .from(expenseParticipants)
            .where(inArray(expenseParticipants.expenseId, expenseIds))
        : [];

    const reimbRows = await db
      .select()
      .from(reimbursements)
      .where(eq(reimbursements.tripId, tripId))
      .orderBy(desc(reimbursements.paymentDate), desc(reimbursements.id));

    const settlementRows = await db
      .select()
      .from(settlements)
      .where(eq(settlements.tripId, tripId))
      .orderBy(asc(settlements.memberId));

    const participantsByExp = new Map<number, ExpenseParticipantRecord[]>();
    for (const p of participantRows) {
      const list = participantsByExp.get(p.expenseId) ?? [];
      list.push({
        id: p.id,
        expenseId: p.expenseId,
        memberId: p.memberId,
        shareAmount: p.shareAmount,
      });
      participantsByExp.set(p.expenseId, list);
    }

    return {
      trip: access.trip,
      myRole: access.myRole,
      myMemberId: access.myMemberId,
      members: memberRows.map(mapMember),
      contributions: contribRows.map(mapContribution),
      expenses: expenseRows.map((e) => ({
        ...mapExpense(e),
        participants: participantsByExp.get(e.id) ?? [],
      })),
      reimbursements: reimbRows.map(mapReimbursement),
      settlements: settlementRows.map(mapSettlement),
    };
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to load trip details', error);
  }
}

export async function createTrip(
  user: UserProfile,
  input: {
    tripName: string;
    destination: string;
    startDate: string;
    endDate: string;
    currency: string;
    defaultMemberBudget: number;
    refundPolicy?: string;
    coverImage?: string;
    members?: Array<{ name: string; email: string; assignedBudget?: number }>;
  },
): Promise<number> {
  try {
    return await db.transaction(async (tx) => {
      const [trip] = await tx
        .insert(trips)
        .values({
          tripName: input.tripName.trim(),
          destination: input.destination.trim(),
          startDate: input.startDate,
          endDate: input.endDate,
          currency: input.currency || 'BDT',
          defaultMemberBudget: Number(input.defaultMemberBudget || 0),
          status: 'ongoing',
          refundPolicy: input.refundPolicy || 'proportional',
          coverImage:
            input.coverImage ||
            '/src/assets/images/trip_coastal_island_1795201698982.jpg',
          createdByUserId: user.id,
        })
        .returning();

      await tx.insert(tripMembers).values({
        tripId: trip.id,
        userId: user.id,
        memberName: user.name,
        memberEmail: user.email,
        assignedBudget: Number(input.defaultMemberBudget || 0),
        role: 'admin',
      });

      if (input.members && input.members.length > 0) {
        const cleanMembers = input.members.filter(
          (m) =>
            m.name.trim().length > 0 &&
            m.email.trim().toLowerCase() !== user.email.toLowerCase(),
        );

        for (const m of cleanMembers) {
          const emailLower = m.email.trim().toLowerCase();
          const matchedUser = await tx
            .select({ id: users.id })
            .from(users)
            .where(sql`lower(${users.email}) = ${emailLower}`)
            .limit(1);

          await tx.insert(tripMembers).values({
            tripId: trip.id,
            userId: matchedUser[0]?.id ?? null,
            memberName: m.name.trim(),
            memberEmail: emailLower,
            assignedBudget: Number(
              m.assignedBudget ?? input.defaultMemberBudget ?? 0,
            ),
            role: 'member',
          });
        }
      }

      return trip.id;
    });
  } catch (error) {
    throw sanitizeDbError('Failed to create trip', error);
  }
}

export async function updateTrip(
  tripId: number,
  userId: number,
  input: {
    tripName?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    currency?: string;
    defaultMemberBudget?: number;
    status?: string;
    refundPolicy?: string;
  },
): Promise<TripRecord> {
  try {
    await assertTripMembership(tripId, userId, true);
    const updatePayload: Partial<typeof trips.$inferInsert> = {};
    if (input.tripName?.trim()) updatePayload.tripName = input.tripName.trim();
    if (input.destination?.trim())
      updatePayload.destination = input.destination.trim();
    if (input.startDate) updatePayload.startDate = input.startDate;
    if (input.endDate) updatePayload.endDate = input.endDate;
    if (input.currency) updatePayload.currency = input.currency;
    if (input.defaultMemberBudget !== undefined) {
      updatePayload.defaultMemberBudget = Number(input.defaultMemberBudget);
    }
    if (input.status) updatePayload.status = input.status;
    if (input.refundPolicy) updatePayload.refundPolicy = input.refundPolicy;

    const [updated] = await db
      .update(trips)
      .set(updatePayload)
      .where(eq(trips.id, tripId))
      .returning();

    return mapTrip(updated);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to update trip', error);
  }
}

export async function deleteTrip(tripId: number, userId: number): Promise<void> {
  try {
    await assertTripMembership(tripId, userId, true);
    await db.delete(trips).where(eq(trips.id, tripId));
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to delete trip', error);
  }
}

export async function addTripMember(
  tripId: number,
  userId: number,
  input: {
    memberName: string;
    memberEmail: string;
    assignedBudget: number;
    role: MemberRole;
  },
): Promise<TripMemberRecord> {
  try {
    await assertTripMembership(tripId, userId, true);
    const cleanEmail = input.memberEmail.trim().toLowerCase();
    const matchedUser = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${cleanEmail}`)
      .limit(1);

    const [inserted] = await db
      .insert(tripMembers)
      .values({
        tripId,
        userId: matchedUser[0]?.id ?? null,
        memberName: input.memberName.trim(),
        memberEmail: cleanEmail,
        assignedBudget: Number(input.assignedBudget || 0),
        role: input.role === 'admin' ? 'admin' : 'member',
      })
      .returning();

    return mapMember(inserted);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to add trip member', error);
  }
}

export async function updateTripMember(
  tripId: number,
  memberId: number,
  userId: number,
  input: { assignedBudget?: number; role?: MemberRole; memberName?: string },
): Promise<TripMemberRecord> {
  try {
    await assertTripMembership(tripId, userId, true);
    const payload: Partial<typeof tripMembers.$inferInsert> = {};
    if (input.assignedBudget !== undefined) {
      payload.assignedBudget = Number(input.assignedBudget);
    }
    if (input.role) {
      payload.role = input.role;
    }
    if (input.memberName?.trim()) {
      payload.memberName = input.memberName.trim();
    }

    const [updated] = await db
      .update(tripMembers)
      .set(payload)
      .where(and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId)))
      .returning();

    if (!updated) {
      throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    }
    return mapMember(updated);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to update member', error);
  }
}

export async function removeTripMember(
  tripId: number,
  memberId: number,
  userId: number,
): Promise<void> {
  try {
    await assertTripMembership(tripId, userId, true);
    const members = await db
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.tripId, tripId));

    const target = members.find((m) => m.id === memberId);
    if (!target) {
      throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    }
    const adminCount = members.filter((m) => m.role === 'admin').length;
    if (target.role === 'admin' && adminCount <= 1) {
      throw Object.assign(
        new Error('Cannot remove the only Trip Administrator'),
        { statusCode: 400 },
      );
    }

    await db
      .delete(tripMembers)
      .where(and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId)));
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to remove trip member', error);
  }
}

export async function addContribution(
  tripId: number,
  userId: number,
  input: {
    memberId: number;
    amount: number;
    contributionType: 'initial' | 'additional';
    paymentDate: string;
    note?: string;
  },
): Promise<ContributionRecord> {
  try {
    const access = await assertTripMembership(tripId, userId, false);
    const approvalStatus = access.myRole === 'admin' ? 'approved' : 'pending';

    const [inserted] = await db
      .insert(contributions)
      .values({
        tripId,
        memberId: input.memberId,
        amount: Number(input.amount),
        contributionType: input.contributionType,
        paymentDate: input.paymentDate,
        note: input.note?.trim() ?? '',
        approvalStatus,
      })
      .returning();

    return mapContribution(inserted);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to record contribution', error);
  }
}

export async function approveContribution(
  tripId: number,
  contributionId: number,
  userId: number,
): Promise<ContributionRecord> {
  try {
    await assertTripMembership(tripId, userId, true);
    const [updated] = await db
      .update(contributions)
      .set({ approvalStatus: 'approved' })
      .where(
        and(
          eq(contributions.id, contributionId),
          eq(contributions.tripId, tripId),
        ),
      )
      .returning();

    if (!updated) {
      throw Object.assign(new Error('Contribution not found'), { statusCode: 404 });
    }
    return mapContribution(updated);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to approve contribution', error);
  }
}

export async function deleteContribution(
  tripId: number,
  contributionId: number,
  userId: number,
): Promise<void> {
  try {
    await assertTripMembership(tripId, userId, true);
    await db
      .delete(contributions)
      .where(
        and(
          eq(contributions.id, contributionId),
          eq(contributions.tripId, tripId),
        ),
      );
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to delete contribution', error);
  }
}

export async function addExpense(
  tripId: number,
  userId: number,
  input: {
    title: string;
    category: string;
    totalAmount: number;
    paidByMemberId: number;
    paymentSource: 'group_fund' | 'personal';
    splitMethod: 'equal' | 'custom' | 'individual';
    expenseDate: string;
    notes?: string;
    participants: Array<{ memberId: number; shareAmount: number }>;
    createReimbursement?: boolean;
  },
): Promise<ExpenseRecord> {
  try {
    const access = await assertTripMembership(tripId, userId, false);
    const approvalStatus = access.myRole === 'admin' ? 'approved' : 'pending';

    return await db.transaction(async (tx) => {
      const [insertedExpense] = await tx
        .insert(expenses)
        .values({
          tripId,
          title: input.title.trim(),
          category: input.category,
          totalAmount: Number(input.totalAmount),
          paidByMemberId: input.paidByMemberId,
          paymentSource: input.paymentSource,
          splitMethod: input.splitMethod,
          expenseDate: input.expenseDate,
          notes: input.notes?.trim() ?? '',
          approvalStatus,
        })
        .returning();

      const insertedParticipants = await tx
        .insert(expenseParticipants)
        .values(
          input.participants.map((p) => ({
            expenseId: insertedExpense.id,
            memberId: p.memberId,
            shareAmount: Number(p.shareAmount),
          })),
        )
        .returning();

      if (input.paymentSource === 'personal' && input.createReimbursement) {
        await tx.insert(reimbursements).values({
          tripId,
          memberId: input.paidByMemberId,
          amount: Number(input.totalAmount),
          status: 'pending',
          paymentSource: 'group_fund',
          paymentDate: input.expenseDate.slice(0, 10),
          note: `Reimbursement for "${input.title.trim()}"`,
        });
      }

      return {
        ...mapExpense(insertedExpense),
        participants: insertedParticipants.map((p) => ({
          id: p.id,
          expenseId: p.expenseId,
          memberId: p.memberId,
          shareAmount: p.shareAmount,
        })),
      };
    });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to record expense', error);
  }
}

export async function approveExpense(
  tripId: number,
  expenseId: number,
  userId: number,
): Promise<void> {
  try {
    await assertTripMembership(tripId, userId, true);
    await db
      .update(expenses)
      .set({ approvalStatus: 'approved' })
      .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)));
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to approve expense', error);
  }
}

export async function deleteExpense(
  tripId: number,
  expenseId: number,
  userId: number,
): Promise<void> {
  try {
    await assertTripMembership(tripId, userId, true);
    await db
      .delete(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)));
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to delete expense', error);
  }
}

export async function addReimbursement(
  tripId: number,
  userId: number,
  input: {
    memberId: number;
    amount: number;
    status: 'pending' | 'completed';
    paymentDate: string;
    note?: string;
  },
): Promise<ReimbursementRecord> {
  try {
    const access = await assertTripMembership(tripId, userId, false);
    const status =
      access.myRole === 'admin' && input.status === 'completed'
        ? 'completed'
        : 'pending';

    const [inserted] = await db
      .insert(reimbursements)
      .values({
        tripId,
        memberId: input.memberId,
        amount: Number(input.amount),
        status,
        paymentSource: 'group_fund',
        paymentDate: input.paymentDate,
        note: input.note?.trim() ?? '',
      })
      .returning();

    return mapReimbursement(inserted);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to create reimbursement', error);
  }
}

export async function updateReimbursementStatus(
  tripId: number,
  reimbursementId: number,
  userId: number,
  status: 'pending' | 'completed',
  paymentDate?: string,
): Promise<ReimbursementRecord> {
  try {
    await assertTripMembership(tripId, userId, true);
    const payload: Partial<typeof reimbursements.$inferInsert> = { status };
    if (paymentDate) payload.paymentDate = paymentDate;

    const [updated] = await db
      .update(reimbursements)
      .set(payload)
      .where(
        and(
          eq(reimbursements.id, reimbursementId),
          eq(reimbursements.tripId, tripId),
        ),
      )
      .returning();

    if (!updated) {
      throw Object.assign(new Error('Reimbursement record not found'), {
        statusCode: 404,
      });
    }
    return mapReimbursement(updated);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to update reimbursement', error);
  }
}

export async function deleteReimbursement(
  tripId: number,
  reimbursementId: number,
  userId: number,
): Promise<void> {
  try {
    await assertTripMembership(tripId, userId, true);
    await db
      .delete(reimbursements)
      .where(
        and(
          eq(reimbursements.id, reimbursementId),
          eq(reimbursements.tripId, tripId),
        ),
      );
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to delete reimbursement', error);
  }
}

export async function upsertSettlements(
  tripId: number,
  userId: number,
  entries: Array<{
    memberId: number;
    totalContributions: number;
    totalPersonalAdvances: number;
    totalExpenseShares: number;
    reimbursementsReceived: number;
    refundsReceived: number;
    netBalance: number;
    settlementStatus: 'pending' | 'completed';
    settledAt: string;
  }>,
  markTripCompleted = false,
): Promise<SettlementRecord[]> {
  try {
    await assertTripMembership(tripId, userId, true);
    return await db.transaction(async (tx) => {
      await tx.delete(settlements).where(eq(settlements.tripId, tripId));
      const inserted =
        entries.length > 0
          ? await tx
              .insert(settlements)
              .values(
                entries.map((e) => ({
                  tripId,
                  memberId: e.memberId,
                  totalContributions: Number(e.totalContributions),
                  totalPersonalAdvances: Number(e.totalPersonalAdvances),
                  totalExpenseShares: Number(e.totalExpenseShares),
                  reimbursementsReceived: Number(e.reimbursementsReceived),
                  refundsReceived: Number(e.refundsReceived),
                  netBalance: Number(e.netBalance),
                  settlementStatus: e.settlementStatus,
                  settledAt: e.settledAt,
                })),
              )
              .returning()
          : [];

      if (markTripCompleted) {
        await tx
          .update(trips)
          .set({ status: 'completed' })
          .where(eq(trips.id, tripId));
      }

      return inserted.map(mapSettlement);
    });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw sanitizeDbError('Failed to save settlement records', error);
  }
}

function mapTrip(row: typeof trips.$inferSelect): TripRecord {
  return {
    id: row.id,
    tripName: row.tripName,
    destination: row.destination,
    startDate: row.startDate,
    endDate: row.endDate,
    currency: row.currency,
    defaultMemberBudget: row.defaultMemberBudget,
    status: row.status as TripRecord['status'],
    refundPolicy: row.refundPolicy as TripRecord['refundPolicy'],
    coverImage: row.coverImage ?? '',
    createdByUserId: row.createdByUserId,
  };
}

function mapMember(row: typeof tripMembers.$inferSelect): TripMemberRecord {
  return {
    id: row.id,
    tripId: row.tripId,
    userId: row.userId,
    memberName: row.memberName,
    memberEmail: row.memberEmail,
    assignedBudget: row.assignedBudget,
    role: row.role === 'admin' ? 'admin' : 'member',
  };
}

function mapContribution(
  row: typeof contributions.$inferSelect,
): ContributionRecord {
  return {
    id: row.id,
    tripId: row.tripId,
    memberId: row.memberId,
    amount: row.amount,
    contributionType:
      row.contributionType === 'additional' ? 'additional' : 'initial',
    paymentDate: row.paymentDate,
    note: row.note ?? '',
    approvalStatus:
      row.approvalStatus === 'pending' ? 'pending' : 'approved',
  };
}

function mapExpense(
  row: typeof expenses.$inferSelect,
): Omit<ExpenseRecord, 'participants'> {
  return {
    id: row.id,
    tripId: row.tripId,
    title: row.title,
    category: row.category,
    totalAmount: row.totalAmount,
    paidByMemberId: row.paidByMemberId,
    paymentSource:
      row.paymentSource === 'personal' ? 'personal' : 'group_fund',
    splitMethod:
      row.splitMethod === 'custom'
        ? 'custom'
        : row.splitMethod === 'individual'
          ? 'individual'
          : 'equal',
    expenseDate: row.expenseDate,
    notes: row.notes ?? '',
    approvalStatus:
      row.approvalStatus === 'pending' ? 'pending' : 'approved',
  };
}

function mapReimbursement(
  row: typeof reimbursements.$inferSelect,
): ReimbursementRecord {
  return {
    id: row.id,
    tripId: row.tripId,
    memberId: row.memberId,
    amount: row.amount,
    status: row.status === 'completed' ? 'completed' : 'pending',
    paymentSource:
      row.paymentSource === 'personal' ? 'personal' : 'group_fund',
    paymentDate: row.paymentDate,
    note: row.note ?? '',
  };
}

function mapSettlement(row: typeof settlements.$inferSelect): SettlementRecord {
  return {
    id: row.id,
    tripId: row.tripId,
    memberId: row.memberId,
    totalContributions: row.totalContributions,
    totalPersonalAdvances: row.totalPersonalAdvances,
    totalExpenseShares: row.totalExpenseShares,
    reimbursementsReceived: row.reimbursementsReceived,
    refundsReceived: row.refundsReceived,
    netBalance: row.netBalance,
    settlementStatus:
      row.settlementStatus === 'completed' ? 'completed' : 'pending',
    settledAt: row.settledAt ?? '',
  };
}
