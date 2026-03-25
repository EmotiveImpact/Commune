import type { GroupType } from '@commune/types';

export type SpaceEssentialFieldKind = 'text' | 'textarea';

export interface SpaceEssentialDefinition {
  key: string;
  label: string;
  placeholder: string;
  description?: string;
  kind: SpaceEssentialFieldKind;
  defaultVisible?: boolean;
}

export interface SpaceEssentialValue {
  label: string;
  value: string;
  visible: boolean;
}

export type SpaceEssentials = Record<string, SpaceEssentialValue>;

const HOME_ESSENTIALS: SpaceEssentialDefinition[] = [
  { key: 'wifi', label: 'Wi-Fi', placeholder: 'Network name / password', kind: 'text', defaultVisible: true },
  { key: 'bins', label: 'Bins', placeholder: 'Collection day and notes', kind: 'text', defaultVisible: true },
  { key: 'landlord', label: 'Landlord', placeholder: 'Main contact name', kind: 'text', defaultVisible: true },
  { key: 'landlord_phone', label: 'Landlord phone', placeholder: 'Contact number', kind: 'text', defaultVisible: true },
  { key: 'emergency', label: 'Emergency', placeholder: 'Emergency contact or utility support', kind: 'text', defaultVisible: true },
  { key: 'rules', label: 'House rules', placeholder: 'Quiet hours, cleaning expectations, access notes', kind: 'textarea', defaultVisible: true },
];

const WORKSPACE_ESSENTIALS: SpaceEssentialDefinition[] = [
  { key: 'access', label: 'Access info', placeholder: 'Door code, keys, arrival notes', kind: 'text', defaultVisible: true },
  { key: 'wifi', label: 'Wi-Fi', placeholder: 'Network name / password', kind: 'text', defaultVisible: true },
  { key: 'hours', label: 'Opening hours', placeholder: 'When the space is open or staffed', kind: 'text', defaultVisible: true },
  { key: 'building_contact', label: 'Building contact', placeholder: 'Manager, landlord, front desk', kind: 'text', defaultVisible: true },
  { key: 'supplies', label: 'Supplies', placeholder: 'Where shared supplies live and reorder notes', kind: 'textarea', defaultVisible: true },
  { key: 'rules', label: 'Workspace rules', placeholder: 'Shared norms, booking rules, shutdown expectations', kind: 'textarea', defaultVisible: true },
];

const PROJECT_ESSENTIALS: SpaceEssentialDefinition[] = [
  { key: 'location', label: 'Location / venue', placeholder: 'Base location or venue info', kind: 'text', defaultVisible: true },
  { key: 'access', label: 'Access info', placeholder: 'Keys, codes, arrival instructions', kind: 'text', defaultVisible: true },
  { key: 'lead_contact', label: 'Lead contact', placeholder: 'Producer, coordinator, point person', kind: 'text', defaultVisible: true },
  { key: 'handover', label: 'Handover notes', placeholder: 'Critical context for the next person or next run', kind: 'textarea', defaultVisible: true },
  { key: 'equipment', label: 'Equipment notes', placeholder: 'Shared gear, storage, setup, return rules', kind: 'textarea', defaultVisible: true },
  { key: 'rules', label: 'Working rules', placeholder: 'Expectations, safety, communication boundaries', kind: 'textarea', defaultVisible: true },
];

const TRIP_ESSENTIALS: SpaceEssentialDefinition[] = [
  { key: 'stay', label: 'Accommodation', placeholder: 'Address, room notes, check-in details', kind: 'textarea', defaultVisible: true },
  { key: 'meetup', label: 'Meet-up point', placeholder: 'Initial meeting point or arrival plan', kind: 'text', defaultVisible: true },
  { key: 'transport', label: 'Transport info', placeholder: 'Tickets, pickup info, car details', kind: 'textarea', defaultVisible: true },
  { key: 'emergency', label: 'Emergency contact', placeholder: 'Emergency contact or local support', kind: 'text', defaultVisible: true },
  { key: 'checkout', label: 'Checkout plan', placeholder: 'Departure time, cleanup, key return', kind: 'textarea', defaultVisible: true },
  { key: 'rules', label: 'Trip rules', placeholder: 'Shared norms, safety notes, reimbursement expectations', kind: 'textarea', defaultVisible: true },
];

const COUPLE_ESSENTIALS: SpaceEssentialDefinition[] = [
  { key: 'calendar', label: 'Shared cadence', placeholder: 'Bills, chores, or routines to keep in sync', kind: 'textarea', defaultVisible: true },
  { key: 'emergency', label: 'Emergency contact', placeholder: 'Useful numbers or contacts', kind: 'text', defaultVisible: true },
  { key: 'rules', label: 'Shared rules', placeholder: 'Agreements, budgets, home norms', kind: 'textarea', defaultVisible: true },
];

const DEFAULT_ESSENTIALS: SpaceEssentialDefinition[] = [
  { key: 'access', label: 'Access info', placeholder: 'How people enter or join the space', kind: 'text', defaultVisible: true },
  { key: 'contact', label: 'Primary contact', placeholder: 'Who to contact when something breaks', kind: 'text', defaultVisible: true },
  { key: 'instructions', label: 'Shared instructions', placeholder: 'Recurring guidance or recurring setup notes', kind: 'textarea', defaultVisible: true },
  { key: 'rules', label: 'Shared rules', placeholder: 'Norms, boundaries, practical expectations', kind: 'textarea', defaultVisible: true },
];

const ESSENTIALS_BY_TYPE: Record<string, SpaceEssentialDefinition[]> = {
  home: HOME_ESSENTIALS,
  workspace: WORKSPACE_ESSENTIALS,
  project: PROJECT_ESSENTIALS,
  trip: TRIP_ESSENTIALS,
  couple: COUPLE_ESSENTIALS,
  other: DEFAULT_ESSENTIALS,
};

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSpaceEssentialDefinitions(groupType?: GroupType | string | null): SpaceEssentialDefinition[] {
  if (!groupType) return DEFAULT_ESSENTIALS;
  return ESSENTIALS_BY_TYPE[groupType] ?? DEFAULT_ESSENTIALS;
}

export function normalizeSpaceEssentials(
  groupType: GroupType | string | null | undefined,
  raw: unknown,
  legacyHouseInfo?: Record<string, string> | null,
): SpaceEssentials {
  const definitions = getSpaceEssentialDefinitions(groupType);
  const defaults = new Map(definitions.map((item) => [item.key, item]));
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacySource = legacyHouseInfo ?? {};
  const normalized: SpaceEssentials = {};

  for (const definition of definitions) {
    const current = source[definition.key];
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const item = current as Record<string, unknown>;
      const value = typeof item.value === 'string' ? item.value : '';
      const visible =
        typeof item.visible === 'boolean'
          ? item.visible
          : definition.defaultVisible !== false;
      if (value) {
        normalized[definition.key] = {
          label: typeof item.label === 'string' ? item.label : definition.label,
          value,
          visible,
        };
      }
      continue;
    }

    if (typeof current === 'string' && current) {
      normalized[definition.key] = {
        label: definition.label,
        value: current,
        visible: definition.defaultVisible !== false,
      };
      continue;
    }

    const legacyValue = legacySource[definition.key];
    if (legacyValue) {
      normalized[definition.key] = {
        label: definition.label,
        value: legacyValue,
        visible: definition.defaultVisible !== false,
      };
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (normalized[key] || value == null) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      const item = value as Record<string, unknown>;
      if (typeof item.value === 'string' && item.value) {
        normalized[key] = {
          label: typeof item.label === 'string' ? item.label : defaults.get(key)?.label ?? toTitleCase(key),
          value: item.value,
          visible: typeof item.visible === 'boolean' ? item.visible : true,
        };
      }
      continue;
    }

    if (typeof value === 'string' && value) {
      normalized[key] = {
        label: defaults.get(key)?.label ?? toTitleCase(key),
        value,
        visible: true,
      };
    }
  }

  return normalized;
}
