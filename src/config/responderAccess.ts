import { ResponderRole } from '../types/dispatch';

export const RESPONDER_ROLES: ResponderRole[] = ['police', 'armed_response', 'ems'];

export const ROLE_MISMATCH_MESSAGES = {
  client: 'Responder accounts must use Responder sign-in.',
  responder:
    'This account is not authorized for responder access. Contact your administrator.',
} as const;
