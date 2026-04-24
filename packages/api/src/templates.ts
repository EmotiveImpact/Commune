import type { Database, SplitTemplate, SplitMethodEnum } from '@commune/types';
import { asJson, toSplitMethod } from '@commune/types';
import { getTypedSupabase, supabase } from './client';

type SplitTemplateInsert = Database['public']['Tables']['split_templates']['Insert'];
type SplitTemplateUpdate = Database['public']['Tables']['split_templates']['Update'];

interface TemplateParticipant {
  user_id: string;
  percentage?: number;
  amount?: number;
}

export async function getGroupTemplates(groupId: string) {
  const { data, error } = await supabase
    .from('split_templates')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as SplitTemplate[];
}

interface CreateTemplateData {
  group_id: string;
  name: string;
  split_method: string;
  participants: TemplateParticipant[];
}

export async function createTemplate(data: CreateTemplateData) {
  const supabase = getTypedSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const splitMethod: SplitMethodEnum = toSplitMethod(data.split_method);

  const insertPayload: SplitTemplateInsert = {
    group_id: data.group_id,
    name: data.name,
    split_method: splitMethod,
    participants: asJson(data.participants),
    created_by: user.id,
  };

  const { data: template, error } = await supabase
    .from('split_templates')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return template as unknown as SplitTemplate;
}

interface UpdateTemplateData {
  name?: string;
  split_method?: string;
  participants?: TemplateParticipant[];
}

export async function updateTemplate(id: string, data: UpdateTemplateData) {
  const supabase = getTypedSupabase();

  const updatePayload: SplitTemplateUpdate = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.split_method !== undefined) {
    updatePayload.split_method = toSplitMethod(data.split_method);
  }
  if (data.participants !== undefined) {
    updatePayload.participants = asJson(data.participants);
  }

  const { data: template, error } = await supabase
    .from('split_templates')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return template as unknown as SplitTemplate;
}

export async function deleteTemplate(id: string) {
  const supabase = getTypedSupabase();
  const { error } = await supabase
    .from('split_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
