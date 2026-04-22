'use client';

import { useEffect, useRef, useState } from 'react';
import { useTimetable } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, CheckCircle } from 'lucide-react';

export default function AutoSync() {
  const { state, importState } = useTimetable();
  const lastSyncedTime = useRef<number>(state.updatedAt || 0);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'syncing' } | null>(null);
  const notificationTimeout = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'syncing', duration = 3000) => {
    if (notificationTimeout.current) clearTimeout(notificationTimeout.current);
    
    setNotification({ message, type });
    
    if (type !== 'syncing') {
      notificationTimeout.current = setTimeout(() => {
        setNotification(null);
      }, duration);
    }
  };

  // Background Load (when returning to app or reloading)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const localTime = state.updatedAt || 0;
        
        // Show syncing only if we really need to check (optional, but good for feedback)
        showNotification('最新の予定を確認中...', 'syncing');
        
        try {
          const res = await fetch('/api/aura/gist/load?t=' + Date.now());
          if (res.ok) {
            const remoteState = await res.json();
            const remoteTime = remoteState.updatedAt || 0;
            
            // If remote is newer, import it
            if (remoteTime > localTime) {
              importState(remoteState);
              lastSyncedTime.current = remoteTime;
              showNotification('最新の予定を読み込みました', 'success');
              console.log('AutoSync: Loaded newer state from Gist.');
            } else {
              showNotification('データは最新です', 'success', 2000);
            }
          } else if (res.status === 404) {
            // No backup found is normal for new users
            setNotification(null);
            console.log('AutoSync: No remote backup found.');
          } else {
            showNotification('同期の確認に失敗しました', 'error');
          }
        } catch (e) {
          console.error('AutoSync Error:', e);
          showNotification('ネットワークエラーが発生しました', 'error');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Initial load check
    handleVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (notificationTimeout.current) clearTimeout(notificationTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importState]);

  // Debounced Auto Save
  useEffect(() => {
    const currentUpdated = state.updatedAt || 0;
    
    // Check if we have new local modifications since last sync
    if (currentUpdated > lastSyncedTime.current) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      
      saveTimeout.current = setTimeout(async () => {
        showNotification('変更を保存中...', 'syncing');
        try {
          // get fresh csrf token
          const csrfRes = await fetch('/api/csrf');
          if (!csrfRes.ok) throw new Error('CSRF fetch failed');
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
            showNotification('変更をクラウドに保存しました', 'success');
            console.log('AutoSync: Saved state to Gist.');
          } else {
            throw new Error('Save to Gist failed');
          }
        } catch (e) {
          console.error('AutoSync Error:', e);
          showNotification('保存に失敗しました', 'error');
        }
      }, 5000); // 5 sec debounce
    }

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [state]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            borderRadius: '16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
          }}
          className="glass notification-toast"
        >
          {notification.type === 'syncing' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Cloud className="icon--primary" size={20} /></motion.div>}
          {notification.type === 'success' && <CheckCircle className="icon--success" size={20} />}
          {notification.type === 'error' && <CloudOff className="icon--danger" size={20} />}
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {notification.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
