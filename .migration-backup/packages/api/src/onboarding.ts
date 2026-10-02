import {
  createSetupChecklistProgress,
  getOperationTemplates,
  getSubtypePreset,
  getSpacePreset,
  type SpacePreset,
} from '@commune/core';
import {
  asJson,
  fromJson,
  type GroupUpdate,
  type SpaceEssentials,
  type SetupChecklistProgress,
} from '@commune/types';
import { getTypedSupabase } from './client';

export interface ApplyStarterPackInput {
  groupType: string;
  subtype?: string | null;
  spaceEssentials?: SpaceEssentials | null;
  includeStarterOperations?: boolean;
}

export interface ApplyStarterPackResult {
  operationsCreated: number;
  essentialsApplied: number;
  preset: SpacePreset;
  hasSubtypePreset: boolean;
}

function toLegacyHouseInfo(spaceEssentials: SpaceEssentials | null | undefined) {
  if (!spaceEssentials) return null;

  const legacy = Object.fromEntries(
    Object.entries(spaceEssentials).map(([key, item]) => [key, item.value]),
  );

  return Object.keys(legacy).length > 0 ? legacy : null;
}

export async function applyGroupStarterPack(
  groupId: string,
  input: ApplyStarterPackInput,
): Promise<ApplyStarterPackResult> {
  const supabase = getTypedSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  let normalizedEssentials: SpaceEssentials | null | undefined;
  if ('spaceEssentials' in input) {
    if (input.spaceEssentials === null) {
      normalizedEssentials = null;
    } else if (input.spaceEssentials && Object.keys(input.spaceEssentials).length > 0) {
      normalizedEssentials = input.spaceEssentials;
    } else {
      normalizedEssentials = undefined;
    }
  }

  const { data: existingGroup, error: existingGroupError } = await supabase
    .from('groups')
    .select('setup_checklist_progress')
    .eq('id', groupId)
    .single();

  if (existingGroupError) throw existingGroupError;

  const checklistProgress = createSetupChecklistProgress(
    input.groupType,
    input.subtype,
    fromJson<SetupChecklistProgress>(existingGroup?.setup_checklist_progress),
  );

  if (normalizedEssentials !== undefined || checklistProgress !== undefined) {
    const updatePayload: GroupUpdate = {
      setup_checklist_progress: asJson(checklistProgress),
    };

    if (normalizedEssentials !== undefined) {
      updatePayload.space_essentials = asJson(normalizedEssentials);
    }

    if (normalizedEssentials !== undefined && input.groupType === 'home') {
      updatePayload.house_info = asJson(toLegacyHouseInfo(normalizedEssentials));
    }

    const { error: groupUpdateError } = await supabase
      .from('groups')
      .update(updatePayload)
      .eq('id', groupId);

    if (groupUpdateError) throw groupUpdateError;
  }

  let operationsCreated = 0;

  if (input.includeStarterOperations) {
    const { count, error: countError } = await supabase
      .from('chores')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (countError) throw countError;

    if ((count ?? 0) === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const starterOperations = getOperationTemplates(input.groupType, input.subtype).map(
        (template) => ({
          group_id: groupId,
          title: template.title,
          description: template.description ?? null,
          category: template.category,
          task_type: template.task_type,
          frequency: template.frequency,
          checklist_items: template.checklist_items ?? null,
          escalation_days: template.escalation_days ?? null,
          assigned_to: null,
          next_due: today,
          created_by: user.id,
        }),
      );

      if (starterOperations.length > 0) {
        const { error: operationsError } = await supabase
          .from('chores')
          .insert(starterOperations);

        if (operationsError) throw operationsError;
        operationsCreated = starterOperations.length;
      }
    }
  }

  const subtypePreset = input.subtype
    ? getSubtypePreset(input.groupType, input.subtype)
    : null;
  const preset = subtypePreset ?? getSpacePreset(input.groupType, input.subtype);

  return {
    operationsCreated,
    essentialsApplied: normalizedEssentials && normalizedEssentials !== null
      ? Object.keys(normalizedEssentials).length
      : 0,
    preset,
    hasSubtypePreset: subtypePreset !== null,
  };
}
