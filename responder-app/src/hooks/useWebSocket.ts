import { useEffect, useRef } from 'react';
import { wsUrl } from '../api/dispatch';
import { Alert } from '../types';

type Handlers = {
  onAlertCreated?: (alert: Alert) => void;
  onAlertSnapshot?: (alert: Alert) => void;
  onLocation?: (data: { alertId: string; location: any }) => void;
  onAssignmentStatus?: (data: any) => void;
};

export function useWebSocket(handlers: Handlers) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(wsUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'subscribe_all' }));
    };

    socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'alert_created' && handlers.onAlertCreated) {
          handlers.onAlertCreated(data.alert);
        }
        if (data.event === 'alert_snapshot' && data.alert && handlers.onAlertSnapshot) {
          handlers.onAlertSnapshot(data.alert);
        }
        if (data.event === 'location_update' && handlers.onLocation) {
          handlers.onLocation({ alertId: data.alertId, location: data.location });
        }
        if (data.event === 'assignment_status' && handlers.onAssignmentStatus) {
          handlers.onAssignmentStatus(data);
        }
      } catch (err) {
        console.log('WS parse error', err);
      }
    };

    return () => {
      socket.close();
    };
  }, [handlers]);

  return socketRef.current;
}
