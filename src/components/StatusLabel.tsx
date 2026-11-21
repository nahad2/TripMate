import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Compass,
  PlayCircle,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';

interface StatusLabelProps {
  status: string;
}

export function StatusLabel({ status }: StatusLabelProps) {
  switch (status) {
    case 'approved':
    case 'verified':
    case 'completed':
    case 'settled':
    case 'accepted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="capitalize">{status.replace('_', ' ')}</span>
        </span>
      );
    case 'pending':
    case 'pending_request':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Pending</span>
        </span>
      );
    case 'needs_correction':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Needs correction</span>
        </span>
      );
    case 'rejected':
    case 'cancelled':
    case 'owes':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="capitalize">{status.replace('_', ' ')}</span>
        </span>
      );
    case 'receivable':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Receivable</span>
        </span>
      );
    case 'active':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 whitespace-nowrap">
          <PlayCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Active</span>
        </span>
      );
    case 'upcoming':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span>Upcoming</span>
        </span>
      );
    case 'planning':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Planning</span>
        </span>
      );
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>Archived</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap capitalize">
          {status.replace('_', ' ')}
        </span>
      );
  }
}

export function RoleLabel({ role }: { role: string }) {
  if (role === 'owner') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
        <span>Owner</span>
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 whitespace-nowrap">
        <UserCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Admin</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      <Users className="w-3.5 h-3.5 shrink-0" />
      <span>Member</span>
    </span>
  );
}
