import { useEffect, useRef } from 'react';
import { dispatchWsUrl } from '../services/DispatchApi';
import { DispatchAlert } from '../types/dispatch';

type Handlers = {
  onAlertCreated?: (alert: DispatchAlert) => void;
  onAlertSnapshot?: (alert: DispatchAlert) => void;
  onLocation?: (data: { alertId: string; location: unknown }) => void;
  onAssignmentStatus?: (data: {
    alertId: string;
    assignment: DispatchAlert['assignments'] extends (infer A)[] | undefined ? A : never;
  }) => void;
};

export function useResponderWebSocket(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = new WebSocket(dispatchWsUrl());

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'subscribe_all' }));
    };

    socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        const h = handlersRef.current;
        if (data.event === 'alert_created' && h.onAlertCreated) {
          h.onAlertCreated(data.alert);
        }
        if (data.event === 'alert_snapshot' && data.alert && h.onAlertSnapshot) {
          h.onAlertSnapshot(data.alert);
        }
        if (data.event === 'location_update' && h.onLocation) {
          h.onLocation({ alertId: data.alertId, location: data.location });
        }
        if (data.event === 'assignment_status' && h.onAssignmentStatus) {
          h.onAssignmentStatus(data);
        }
      } catch (err) {
        console.log('WS parse error', err);
      }
    };

    return () => socket.close();
  }, []);
}
