import { DEFAULT_EXPENSE_CATEGORIES, getDb, logActivity, createNotification } from './db.ts';
import { hashPassword } from './auth.ts';
import { computeShares } from './finance.ts';

export function seedIfEmpty(): void {
  const db = getDb();
  const userCount = (db.prepare(`SELECT COUNT(*) AS cnt FROM users`).get() as { cnt: number }).cnt;
  if (userCount > 0) return;

  const insertSeed = db.transaction(() => {
    // Seed default categories
    const insertCat = db.prepare(
      `INSERT INTO expense_categories (trip_id, name, is_default) VALUES (NULL, ?, 1)`
    );
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      insertCat.run(cat);
    }

    // Seed demo accounts with scrypt hashes
    const demoPassHash = hashPassword('TripMate2026!');
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password_hash, phone, bio, avatar_url, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    );

    const arafatId = Number(
      insertUser.run(
        'Arafat Rahman',
        'arafat@tripmate.app',
        demoPassHash,
        '+880 1711-004821',
        'Trip organizer and logistics coordinator for university & mountain expeditions.',
        ''
      ).lastInsertRowid
    );
    const nadiaId = Number(
      insertUser.run(
        'Nadia Karim',
        'nadia@tripmate.app',
        demoPassHash,
        '+880 1819-332190',
        'Finance lead who keeps receipts organized and settlements transparent.',
        ''
      ).lastInsertRowid
    );
    const tariqId = Number(
      insertUser.run(
        'Tariq Hasan',
        'tariq@tripmate.app',
        demoPassHash,
        '+880 1912-887410',
        'Photographer and trail planner.',
        ''
      ).lastInsertRowid
    );
    const samiraId = Number(
      insertUser.run(
        'Samira Chowdhury',
        'samira@tripmate.app',
        demoPassHash,
        '+880 1675-221904',
        'Foodie and accommodation researcher.',
        ''
      ).lastInsertRowid
    );
    const rafiId = Number(
      insertUser.run(
        'Rafiul Islam',
        'rafi@tripmate.app',
        demoPassHash,
        '+880 1755-908112',
        'Weekend traveler looking to join group expeditions.',
        ''
      ).lastInsertRowid
    );

    // Create 4 realistic trips using generated local images
    const insertTrip = db.prepare(
      `INSERT INTO trips (name, destination, start_date, end_date, description, cover_image, visibility, show_member_count, status, estimated_budget_minor, expected_per_member_minor, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
    );

    const sajekTripId = Number(
      insertTrip.run(
        'Sajek Valley & Rangamati Expedition',
        'Sajek Valley, Rangamati',
        '2026-11-18',
        '2026-11-23',
        'Five-day hill-tract journey covering Ruilui Para sunrise ridge, Konglak Peak trek, Kaptai Lake boat charter, and indigenous cottage stays.',
        '/src/assets/images/trip_cover_mountains_1795281225911.jpg',
        'public',
        'active',
        6000000, // ৳60,000
        1200000, // ৳12,000 per member
        arafatId
      ).lastInsertRowid
    );

    const saintMartinTripId = Number(
      insertTrip.run(
        'Saint Martin Coral Island Retreat',
        'Saint Martin Island, Cox’s Bazar',
        '2026-12-12',
        '2026-12-16',
        'Coastal snorkeling, Chhera Dwip boat transfer, beachfront eco-resort stay, and evening seafood barbecue.',
        '/src/assets/images/trip_cover_coast_1795281225701.jpg',
        'public',
        'upcoming',
        4800000,
        1200000,
        nadiaId
      ).lastInsertRowid
    );

    const heritageTripId = Number(
      insertTrip.run(
        'Old Dhaka & Sonargaon Heritage Walk',
        'Panam Nagar & Lalbagh',
        '2026-10-02',
        '2026-10-04',
        'Weekend architectural walk across Panam City, Goaldi Mosque, Ahsan Manzil, and traditional culinary stops.',
        '/src/assets/images/trip_cover_heritage_1795281225591.jpg',
        'public',
        'completed',
        1200000,
        300000,
        arafatId
      ).lastInsertRowid
    );

    const sylhetTripId = Number(
      insertTrip.run(
        'Sylhet Tea Highlands & Ratargul',
        'Srimangal & Ratargul',
        '2027-01-08',
        '2027-01-11',
        'Tea estate cycling loop, Lawachara rainforest trail, and swamp forest boat morning.',
        '/src/assets/images/trip_cover_highlands_1795281225148.jpg',
        'public',
        'planning',
        3200000,
        800000,
        tariqId
      ).lastInsertRowid
    );

    // Members for Trip 1 (Sajek)
    const addMember = db.prepare(
      `INSERT INTO trip_members (trip_id, user_id, role, status) VALUES (?, ?, ?, 'active')`
    );
    addMember.run(sajekTripId, arafatId, 'owner');
    addMember.run(sajekTripId, nadiaId, 'admin');
    addMember.run(sajekTripId, tariqId, 'member');
    addMember.run(sajekTripId, samiraId, 'member');

    db.prepare(
      `INSERT INTO admin_permissions (trip_id, user_id, can_manage_members, can_approve_expenses, can_manage_contributions, can_edit_expenses, can_manage_notes, can_publish_announcements, can_view_reports, can_manage_schedule)
       VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1)`
    ).run(sajekTripId, nadiaId);

    // Members for Trip 2 (Saint Martin)
    addMember.run(saintMartinTripId, nadiaId, 'owner');
    addMember.run(saintMartinTripId, arafatId, 'admin');
    addMember.run(saintMartinTripId, tariqId, 'member');
    db.prepare(
      `INSERT INTO admin_permissions (trip_id, user_id, can_manage_members, can_approve_expenses, can_manage_contributions, can_edit_expenses, can_manage_notes, can_publish_announcements, can_view_reports, can_manage_schedule)
       VALUES (?, ?, 0, 1, 1, 0, 1, 1, 1, 1)`
    ).run(saintMartinTripId, arafatId);

    // Members for Trip 3 (Heritage - Completed)
    addMember.run(heritageTripId, arafatId, 'owner');
    addMember.run(heritageTripId, nadiaId, 'member');
    addMember.run(heritageTripId, tariqId, 'member');
    addMember.run(heritageTripId, samiraId, 'member');

    // Members for Trip 4 (Sylhet - Planning)
    addMember.run(sylhetTripId, tariqId, 'owner');
    addMember.run(sylhetTripId, samiraId, 'member');

    // Join request from Rafi on Sajek
    db.prepare(
      `INSERT INTO join_requests (trip_id, user_id, message, status) VALUES (?, ?, ?, 'pending')`
    ).run(sajekTripId, rafiId, 'I have hiking gear ready and can meet the Dhaka departure bus at 10 PM.');

    // Invitation for Samira to Saint Martin
    db.prepare(
      `INSERT INTO trip_invitations (trip_id, invited_email, invited_user_id, invited_by, status) VALUES (?, ?, ?, ?, 'pending')`
    ).run(saintMartinTripId, 'samira@tripmate.app', samiraId, nadiaId);

    // Partial & delayed contributions on Sajek (all in minor units = taka * 100)
    const addContrib = db.prepare(
      `INSERT INTO contributions (trip_id, member_id, amount_minor, contribution_date, payment_method, recorded_by, note, status, verified_by, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    addContrib.run(sajekTripId, arafatId, 1200000, '2026-11-10', 'bKash', arafatId, 'Full initial deposit', 'verified', arafatId, '2026-11-10T10:00:00Z');
    addContrib.run(sajekTripId, nadiaId, 1000000, '2026-11-11', 'Bank Transfer', nadiaId, 'Initial partial installment', 'verified', arafatId, '2026-11-11T14:20:00Z');
    addContrib.run(sajekTripId, tariqId, 600000, '2026-11-12', 'bKash', arafatId, 'First half deposit; balance on arrival', 'verified', arafatId, '2026-11-12T18:05:00Z');
    addContrib.run(sajekTripId, samiraId, 500000, '2026-11-14', 'Cash', samiraId, 'Submitted cash to Nadia at bus counter', 'pending', null, null);

    // Expenses on Sajek
    const addExpense = db.prepare(
      `INSERT INTO expenses (trip_id, title, description, amount_minor, category, expense_date, paid_by_member_id, payment_source, split_type, receipt_note, notes, status, submitted_by, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const addParticipant = db.prepare(
      `INSERT INTO expense_participants (expense_id, member_id, share_minor) VALUES (?, ?, ?)`
    );

    // 1. Approved Group Fund Equal Split (Chander Gari 4x4 Jeep)
    const exp1Id = Number(
      addExpense.run(
        sajekTripId,
        'Chander Gari 4x4 Jeep Charter (Khagrachari – Sajek)',
        'Round-trip mountain jeep booked for the full 4-member group.',
        920000, // ৳9,200
        'Transportation',
        '2026-11-18',
        arafatId,
        'group_fund',
        'equal',
        'Receipt #CG-402',
        'Includes hill toll and driver overnight allowance.',
        'approved',
        arafatId,
        nadiaId,
        '2026-11-18T11:30:00Z'
      ).lastInsertRowid
    );
    for (const s of computeShares(920000, 'equal', [arafatId, nadiaId, tariqId, samiraId])) {
      addParticipant.run(exp1Id, s.memberId, s.shareMinor);
    }

    // 2. Approved Group Fund Custom Split (Ruilui Cottage Stay - 2 rooms unequal)
    const exp2Id = Number(
      addExpense.run(
        sajekTripId,
        'Megh Machang Wooden Cottage (2 Nights)',
        'Ridge-facing double room + standard twin room.',
        1100000, // ৳11,000
        'Accommodation',
        '2026-11-19',
        arafatId,
        'group_fund',
        'custom',
        'Invoice #MM-118',
        'Arafat & Tariq took the larger balcony suite.',
        'approved',
        nadiaId,
        arafatId,
        '2026-11-19T09:15:00Z'
      ).lastInsertRowid
    );
    for (const s of computeShares(1100000, 'custom', [arafatId, nadiaId, tariqId, samiraId], [
      { memberId: arafatId, shareMinor: 325000 },
      { memberId: tariqId, shareMinor: 325000 },
      { memberId: nadiaId, shareMinor: 225000 },
      { memberId: samiraId, shareMinor: 225000 },
    ])) {
      addParticipant.run(exp2Id, s.memberId, s.shareMinor);
    }

    // 3. Approved Participation-Based Split paid from PERSONAL MONEY by Tariq (Only 3 members joined Konglak lunch)
    const exp3Id = Number(
      addExpense.run(
        sajekTripId,
        'Bamboo Chicken & Hill Lunch at Konglak Trail',
        'Lunch for the 3 hikers who climbed Konglak Peak; Samira rested at camp.',
        180000, // ৳1,800
        'Lunch',
        '2026-11-19',
        tariqId,
        'personal',
        'participation',
        'Handwritten bill #14',
        'Tariq paid personally because group fund cash holder stayed at cottage.',
        'approved',
        tariqId,
        nadiaId,
        '2026-11-19T16:10:00Z'
      ).lastInsertRowid
    );
    for (const s of computeShares(180000, 'participation', [arafatId, nadiaId, tariqId])) {
      addParticipant.run(exp3Id, s.memberId, s.shareMinor);
    }

    // 4. Pending Expense Submission from Samira (awaiting Admin approval)
    const exp4Id = Number(
      addExpense.run(
        sajekTripId,
        'Evening Bonfire Snacks & Ginger Tea',
        'Purchased tea, biscuits, and firewood bundle for the group.',
        125000, // ৳1,250
        'Snacks and Drinks',
        '2026-11-20',
        samiraId,
        'personal',
        'equal',
        'Receipt #ST-09',
        'Paid via personal cash at Ruilui bazaar.',
        'pending',
        samiraId,
        null,
        null
      ).lastInsertRowid
    );
    for (const s of computeShares(125000, 'equal', [arafatId, nadiaId, tariqId, samiraId])) {
      addParticipant.run(exp4Id, s.memberId, s.shareMinor);
    }

    // Partial reimbursement recorded for Tariq (৳1,000 completed out of ৳1,800 personal spend)
    db.prepare(
      `INSERT INTO reimbursements (trip_id, member_id, amount_minor, payment_date, payment_method, note, status, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sajekTripId, tariqId, 100000, '2026-11-20', 'bKash', 'Partial reimbursement for Konglak lunch', 'completed', arafatId);

    // Heritage Completed Trip Financial Records (fully reconciled)
    addContrib.run(heritageTripId, arafatId, 300000, '2026-10-01', 'Cash', arafatId, 'Initial pool', 'verified', arafatId, '2026-10-01T08:00:00Z');
    addContrib.run(heritageTripId, nadiaId, 300000, '2026-10-01', 'bKash', arafatId, 'Initial pool', 'verified', arafatId, '2026-10-01T08:30:00Z');
    addContrib.run(heritageTripId, tariqId, 300000, '2026-10-01', 'bKash', arafatId, 'Initial pool', 'verified', arafatId, '2026-10-01T09:00:00Z');
    addContrib.run(heritageTripId, samiraId, 300000, '2026-10-01', 'Cash', arafatId, 'Initial pool', 'verified', arafatId, '2026-10-01T09:15:00Z');

    const hExpId = Number(
      addExpense.run(
        heritageTripId,
        'Chartered Microbus & Entry Passes',
        'Full-day AC Hiace + Panam Nagar museum tickets.',
        1040000,
        'Transportation',
        '2026-10-02',
        arafatId,
        'group_fund',
        'equal',
        'Invoice #HD-901',
        '',
        'approved',
        arafatId,
        arafatId,
        '2026-10-02T19:00:00Z'
      ).lastInsertRowid
    );
    for (const s of computeShares(1040000, 'equal', [arafatId, nadiaId, tariqId, samiraId])) {
      addParticipant.run(hExpId, s.memberId, s.shareMinor);
    }

    // General Notes & Expense Notes on Sajek
    db.prepare(
      `INSERT INTO general_notes (trip_id, title, content, is_pinned, is_archived, author_id, updated_by)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(
      sajekTripId,
      'Departure & Check-in Logistics',
      'Bus departs Arambagh counter at 10:30 PM sharp. Carry national ID copy for BGB checkposts at Baghaihat. Emergency contact: Driver Jamal (+880 1712-998811).',
      1,
      arafatId,
      arafatId
    );

    db.prepare(
      `INSERT INTO general_notes (trip_id, title, content, is_pinned, is_archived, author_id, updated_by)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(
      sajekTripId,
      'Essential Packing Checklist',
      'Light windbreaker for sunrise ridge, power bank (cottage solar shuts off at 11 PM), trail shoes, and refillable water bottle.',
      0,
      nadiaId,
      nadiaId
    );

    db.prepare(
      `INSERT INTO expense_notes (trip_id, expense_id, title, content, author_id, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      sajekTripId,
      exp2Id,
      'Why Cottage Room Shares Differ',
      'Room 1 has a larger mountain deck and extra mattress, so Arafat and Tariq agreed to split ৳6,500 between them while Nadia and Samira split ৳4,500 for Room 2.',
      nadiaId,
      nadiaId
    );

    db.prepare(
      `INSERT INTO expense_notes (trip_id, expense_id, title, content, author_id, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      sajekTripId,
      exp3Id,
      'Konglak Peak Lunch Exclusion Note',
      'Samira stayed back at Ruilui Para due to ankle fatigue and had her own meal separately. She is excluded from the Konglak bamboo chicken bill.',
      tariqId,
      tariqId
    );

    // Announcements
    db.prepare(
      `INSERT INTO announcements (trip_id, title, message, priority, author_id) VALUES (?, ?, ?, ?, ?)`
    ).run(
      sajekTripId,
      'Jeep Escort Assembly at Baghaihat',
      'Please assemble near the Baghaihat army checkpost by 10:15 AM tomorrow for the morning convoy.',
      'urgent',
      arafatId
    );
    db.prepare(
      `INSERT INTO announcements (trip_id, title, message, priority, author_id) VALUES (?, ?, ?, ?, ?)`
    ).run(
      sajekTripId,
      'Submit Pending Receipts Before Dinner',
      'Anyone who paid personally for snacks or water today please log an expense request before 8 PM so Nadia can review it.',
      'normal',
      nadiaId
    );

    // Trip Schedule
    const addSchedule = db.prepare(
      `INSERT INTO trip_schedules (trip_id, title, activity_date, activity_time, location, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    addSchedule.run(sajekTripId, 'Night Coach Departure from Dhaka', '2026-11-18', '22:30', 'Arambagh Bus Terminal', 'Check-in 30 minutes prior.', arafatId);
    addSchedule.run(sajekTripId, '4x4 Jeep Ascent & Cottage Check-in', '2026-11-19', '11:00', 'Ruilui Para, Sajek', 'Convoy ride through Masalong bazaar.', arafatId);
    addSchedule.run(sajekTripId, 'Konglak Peak Sunset Trek', '2026-11-19', '15:30', 'Konglak Para', '45-minute ridge hike for panoramic valley views.', tariqId);
    addSchedule.run(sajekTripId, 'Cloud Sunrise & Helipad Coffee', '2026-11-20', '05:45', 'Sajek Helipad', 'Early sunrise observation over Mizoram hills.', nadiaId);

    // Activity Logs
    logActivity(db, {
      tripId: sajekTripId,
      userId: arafatId,
      actionType: 'trip_created',
      recordType: 'trip',
      recordId: sajekTripId,
      summary: 'Created trip "Sajek Valley & Rangamati Expedition" with ৳60,000 estimated budget.',
    });
    logActivity(db, {
      tripId: sajekTripId,
      userId: nadiaId,
      actionType: 'expense_approved',
      recordType: 'expense',
      recordId: exp1Id,
      summary: 'Approved expense "Chander Gari 4x4 Jeep Charter" (৳9,200) paid from Group Fund.',
    });
    logActivity(db, {
      tripId: sajekTripId,
      userId: nadiaId,
      actionType: 'expense_approved',
      recordType: 'expense',
      recordId: exp3Id,
      summary: 'Approved personal payment expense "Bamboo Chicken & Hill Lunch" (৳1,800) paid by Tariq Hasan.',
    });

    // Notifications
    createNotification(db, {
      userId: arafatId,
      tripId: sajekTripId,
      type: 'join_request',
      title: 'New Join Request',
      message: 'Rafiul Islam requested to join Sajek Valley & Rangamati Expedition.',
    });
    createNotification(db, {
      userId: nadiaId,
      tripId: sajekTripId,
      type: 'expense_submitted',
      title: 'Expense Pending Approval',
      message: 'Samira Chowdhury submitted "Evening Bonfire Snacks & Ginger Tea" (৳1,250) for review.',
    });
    createNotification(db, {
      userId: samiraId,
      tripId: saintMartinTripId,
      type: 'invitation',
      title: 'Trip Invitation',
      message: 'Nadia Karim invited you to join Saint Martin Coral Island Retreat.',
    });
  });

  insertSeed();
}
