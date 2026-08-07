"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MY_SERVICE_DEFINITIONS = void 0;
exports.buildMyServicesCatalog = buildMyServicesCatalog;
exports.relabelMyServices = relabelMyServices;
const entitlements_1 = require("./entitlements");
exports.MY_SERVICE_DEFINITIONS = [
    {
        id: 'svc_safety_sos',
        moduleId: 'SAFETY',
        title: 'Emergency SOS',
        description: 'Open Home to send an emergency alert (existing SOS path).',
        route: 'home_sos',
        icon: 'warning',
    },
    {
        id: 'svc_ops_report',
        moduleId: 'OPERATIONS',
        title: 'Report an issue',
        description: 'Submit a facilities / maintenance request.',
        route: 'report_issue',
        icon: 'construct',
    },
    {
        id: 'svc_ops_my_requests',
        moduleId: 'OPERATIONS',
        title: 'My requests',
        description: 'View facilities requests you submitted.',
        route: 'my_requests',
        icon: 'list',
    },
    {
        id: 'svc_ride_safety',
        moduleId: 'RIDE_SAFETY',
        title: 'Ride safety',
        description: 'Request a safe walk / ride escort (module foundation).',
        route: 'ride_safety',
        icon: 'car',
    },
    {
        id: 'svc_community',
        moduleId: 'COMMUNITY',
        title: 'Community',
        description: 'Groups, events, and neighbour alerts.',
        route: 'community_hub',
        icon: 'people',
    },
    {
        id: 'svc_community_alerts',
        moduleId: 'COMMUNITY_ALERTS',
        title: 'Community alerts',
        description: 'Missing pet and local community notices.',
        route: 'community_hub',
        icon: 'paw',
    },
    {
        id: 'svc_groups',
        moduleId: 'GROUPS',
        title: 'Groups',
        description: 'Campus or community groups.',
        route: 'community_hub',
        icon: 'people-circle',
    },
    {
        id: 'svc_events',
        moduleId: 'EVENTS',
        title: 'Events',
        description: 'Local events from your organisation.',
        route: 'community_hub',
        icon: 'calendar',
    },
    {
        id: 'svc_broadcasts',
        moduleId: 'BROADCASTS',
        title: 'Official broadcasts',
        description: 'Organisation announcements (not community alerts).',
        route: 'broadcasts',
        icon: 'megaphone',
    },
];
function buildMyServicesCatalog(input) {
    const entitledOnly = input.entitledOnly !== false;
    const items = [];
    for (const def of exports.MY_SERVICE_DEFINITIONS) {
        const entitled = (0, entitlements_1.personHasModuleEntitlement)(input.entitlements, def.moduleId, {
            organisationId: input.organisationId || undefined,
        });
        const entitledAny = entitled || (0, entitlements_1.personHasModuleEntitlement)(input.entitlements, def.moduleId);
        if (entitledOnly && !entitledAny)
            continue;
        const match = input.entitlements.find(e => e.moduleId === def.moduleId && e.status === 'active');
        items.push({
            ...def,
            entitled: entitledAny,
            source: match?.source,
        });
    }
    return items;
}
function relabelMyServices(services, terminology) {
    if (!terminology)
        return services;
    const requestLabel = terminology.request || 'Request';
    return services.map(s => {
        if (s.route === 'report_issue') {
            return {
                ...s,
                title: `Report a ${requestLabel.toLowerCase()}`,
                description: `Submit a ${requestLabel.toLowerCase()} to your ${terminology.organization || 'organisation'}.`,
            };
        }
        if (s.route === 'my_requests') {
            return {
                ...s,
                title: `My ${requestLabel.toLowerCase()}s`,
                description: `View ${requestLabel.toLowerCase()}s you submitted.`,
            };
        }
        return s;
    });
}
