import { useState } from 'react';
import { apiFetch, setAuthToken } from './api';
import type { User } from './types';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { PublicTripModal } from './components/PublicTripModal';
import { UserDashboard } from './components/UserDashboard';
import { TripWorkspace } from './components/TripWorkspace';

type ViewState =
  | { name: 'landing' }
  | { name: 'dashboard' }
  | { name: 'workspace'; tripId: number };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>({ name: 'landing' });
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [publicTripId, setPublicTripId] = useState<number | null>(null);

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    }
    setAuthToken(null);
    setUser(null);
    setView({ name: 'landing' });
  }

  function handleAuthSuccess(loggedInUser: User) {
    setUser(loggedInUser);
    setAuthModalMode(null);
    // If user was viewing a public trip detail modal to send a join request, keep it open so they can submit immediately
    if (publicTripId === null) {
      setView({ name: 'dashboard' });
    }
  }

  return (
    <>
      {view.name === 'landing' && (
        <LandingPage
          currentUser={user}
          onOpenAuth={(mode) => setAuthModalMode(mode)}
          onOpenDashboard={() => setView({ name: 'dashboard' })}
          onSelectPublicTrip={(tripId) => setPublicTripId(tripId)}
        />
      )}

      {view.name === 'dashboard' && user && (
        <UserDashboard
          user={user}
          onUserUpdated={setUser}
          onLogout={handleLogout}
          onExplorePublic={() => setView({ name: 'landing' })}
          onOpenTrip={(tripId) => setView({ name: 'workspace', tripId })}
        />
      )}

      {view.name === 'workspace' && user && (
        <TripWorkspace
          tripId={view.tripId}
          currentUser={user}
          onBackToDashboard={() => setView({ name: 'dashboard' })}
        />
      )}

      {publicTripId !== null && (
        <PublicTripModal
          tripId={publicTripId}
          currentUser={user}
          onClose={() => setPublicTripId(null)}
          onRequireAuth={() => setAuthModalMode('login')}
          onOpenTripWorkspace={(tripId) => {
            setPublicTripId(null);
            setView({ name: 'workspace', tripId });
          }}
        />
      )}

      {authModalMode !== null && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
}
