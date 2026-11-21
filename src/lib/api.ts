import { auth, googleAuthProvider } from './firebase.ts';
import { signInWithPopup, signOut } from 'firebase/auth';
import type {
  ContributionRecord,
  ExpenseRecord,
  MemberRole,
  ReimbursementRecord,
  SettlementRecord,
  TripDetailPayload,
  TripListItem,
  TripMemberRecord,
  TripRecord,
  UserProfile,
} from './tripmate-types.ts';

let memoryToken: string | null = null;

export function setMemoryAuthToken(token: string | null) {
  memoryToken = token;
}

async function getFreshToken(): Promise<string> {
  if (auth.currentUser) {
    const fresh = await auth.currentUser.getIdToken();
    memoryToken = fresh;
    return fresh;
  }
  if (memoryToken) return memoryToken;
  throw new Error('Authentication required');
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getFreshToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function signInWithGoogle(): Promise<void> {
  const result = await signInWithPopup(auth, googleAuthProvider);
  const token = await result.user.getIdToken();
  setMemoryAuthToken(token);
}

export async function signOutUser(): Promise<void> {
  setMemoryAuthToken(null);
  await signOut(auth);
}

export async function fetchMe(): Promise<{
  user: UserProfile;
  trips: TripListItem[];
}> {
  return apiRequest('/api/me');
}

export async function updateProfile(payload: {
  name?: string;
  phone?: string;
  defaultCurrency?: string;
}): Promise<{ user: UserProfile }> {
  return apiRequest('/api/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchTrips(): Promise<{ trips: TripListItem[] }> {
  return apiRequest('/api/trips');
}

export async function createTripApi(payload: {
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  defaultMemberBudget: number;
  refundPolicy: string;
  coverImage?: string;
  members?: Array<{ name: string; email: string; assignedBudget?: number }>;
}): Promise<{ tripId: number }> {
  return apiRequest('/api/trips', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createSampleTripApi(
  template: 'coxs-bazar' | 'sylhet',
): Promise<{ tripId: number }> {
  return apiRequest('/api/trips/sample', {
    method: 'POST',
    body: JSON.stringify({ template }),
  });
}

export async function fetchTripDetail(tripId: number): Promise<TripDetailPayload> {
  return apiRequest(`/api/trips/${tripId}`);
}

export async function updateTripApi(
  tripId: number,
  payload: Partial<TripRecord>,
): Promise<{ trip: TripRecord }> {
  return apiRequest(`/api/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTripApi(tripId: number): Promise<void> {
  await apiRequest(`/api/trips/${tripId}`, { method: 'DELETE' });
}

export async function addMemberApi(
  tripId: number,
  payload: {
    memberName: string;
    memberEmail: string;
    assignedBudget: number;
    role: MemberRole;
  },
): Promise<{ member: TripMemberRecord }> {
  return apiRequest(`/api/trips/${tripId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMemberApi(
  tripId: number,
  memberId: number,
  payload: { assignedBudget?: number; role?: MemberRole; memberName?: string },
): Promise<{ member: TripMemberRecord }> {
  return apiRequest(`/api/trips/${tripId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function removeMemberApi(
  tripId: number,
  memberId: number,
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function addContributionApi(
  tripId: number,
  payload: {
    memberId: number;
    amount: number;
    contributionType: 'initial' | 'additional';
    paymentDate: string;
    note?: string;
  },
): Promise<{ contribution: ContributionRecord }> {
  return apiRequest(`/api/trips/${tripId}/contributions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function approveContributionApi(
  tripId: number,
  contributionId: number,
): Promise<{ contribution: ContributionRecord }> {
  return apiRequest(
    `/api/trips/${tripId}/contributions/${contributionId}/approve`,
    { method: 'PATCH' },
  );
}

export async function deleteContributionApi(
  tripId: number,
  contributionId: number,
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/contributions/${contributionId}`, {
    method: 'DELETE',
  });
}

export async function addExpenseApi(
  tripId: number,
  payload: {
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
): Promise<{ expense: ExpenseRecord }> {
  return apiRequest(`/api/trips/${tripId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function approveExpenseApi(
  tripId: number,
  expenseId: number,
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/expenses/${expenseId}/approve`, {
    method: 'PATCH',
  });
}

export async function deleteExpenseApi(
  tripId: number,
  expenseId: number,
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}

export async function addReimbursementApi(
  tripId: number,
  payload: {
    memberId: number;
    amount: number;
    status: 'pending' | 'completed';
    paymentDate: string;
    note?: string;
  },
): Promise<{ reimbursement: ReimbursementRecord }> {
  return apiRequest(`/api/trips/${tripId}/reimbursements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateReimbursementApi(
  tripId: number,
  reimbursementId: number,
  payload: { status: 'pending' | 'completed'; paymentDate?: string },
): Promise<{ reimbursement: ReimbursementRecord }> {
  return apiRequest(`/api/trips/${tripId}/reimbursements/${reimbursementId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteReimbursementApi(
  tripId: number,
  reimbursementId: number,
): Promise<void> {
  await apiRequest(`/api/trips/${tripId}/reimbursements/${reimbursementId}`, {
    method: 'DELETE',
  });
}

export async function finalizeSettlementsApi(
  tripId: number,
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
  markTripCompleted: boolean,
): Promise<{ settlements: SettlementRecord[] }> {
  return apiRequest(`/api/trips/${tripId}/settlements/finalize`, {
    method: 'POST',
    body: JSON.stringify({ entries, markTripCompleted }),
  });
}

export async function downloadProjectZipApi(): Promise<void> {
  const token = await getFreshToken();
  const res = await fetch('/api/export-project-zip', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to download zip (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'tripmate-full-project.zip';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
