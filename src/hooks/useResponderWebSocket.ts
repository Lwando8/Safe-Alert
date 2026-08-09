import { useEffect, useRef } from 'react';
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

/**
 * After Firestore SOS cutover, Express WebSocket is not authoritative.
 * Hook is a no-op; ResponderMapScreen polling refreshes nearby incidents.
 */
export function useResponderWebSocket(_handlers: Handlers) {
  const handlersRef = useRef(_handlers);
  handlersRef.current = _handlers;

  useEffect(() => {
    // Intentionally disconnected — do not open Express WS for Firestore incidents.
  }, []);
}
