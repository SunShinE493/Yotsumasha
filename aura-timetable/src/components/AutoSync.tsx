'use client';

import { useEffect, useRef } from 'react';
import { useTimetable } from '@/lib/store';
import { useSession } from 'next-auth/react';

export default function AutoSync() {
  const { state, importState } = useTimetable();
  const { status } = useSession();
  const lastSyncedTime = useRef<number>(state.updatedAt || 0);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Background Load (when returning to app)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && status === 'authenticated') {
        try {
          const res = await fetch('/api/aura/gist/load?t=' + Date.now());
          if (res.ok) {
            const remoteState = await res.json();
            const localTime = state.updatedAt || 0;
            const remoteTime = remoteState.updatedAt || 0;
            
            // If remote is newer, import it
            if (remoteTime > localTime) {
              importState(remoteState);
              lastSyncedTime.current = remoteTime;
              console.log('AutoSync: Loaded newer state from Gist.');
            }
          }
        } catch (e) {
          // Silent fail on network error
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Initial load check
    handleVisibilityChange();

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // deliberately omitting state to avoid polling on every local state change
  }, [status, importState]);

  // Debounced Auto Save
  useEffect(() => {
    if (status !== 'authenticated') return;

    const currentUpdated = state.updatedAt || 0;
    
    // Check if we have new local modifications since last sync
    if (currentUpdated > lastSyncedTime.current) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      
      saveTimeout.current = setTimeout(async () => {
        try {
          // get fresh csrf token
          const csrfRes = await fetch('/api/csrf');
          if (!csrfRes.ok) return;
          const { csrfToken } = await csrfRes.json();

          const res = await fetch('/api/aura/gist/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'csrf-token': csrfToken
            },
            body: JSON.stringify({
              ...state,
              _csrf: csrfToken
            })
          });

          if (res.ok) {
            lastSyncedTime.current = currentUpdated;
            console.log('AutoSync: Saved state to Gist.');
          }
        } catch (e) {
          console.error('AutoSync Error:', e);
        }
      }, 5000); // 5 sec debounce
    }

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [state, status]);

  return null;
}
