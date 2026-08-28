import type { SplitTemplate } from '@commune/types';
import { supabase } from './client';

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
  participants: {
    user_id: string;
    percentage?: number;
    amount?: number;
  }[];
}

export async function createTemplate(data: CreateTemplateData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: template, error } = await supabase
    .from('split_templates')
    .insert({
      group_id: data.group_id,
      name: data.name,
      split_method: data.split_method,
      participants: data.participants,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return template as unknown as SplitTemplate;
}

interface UpdateTemplateData {
  name?: string;
  split_method?: string;
  participants?: {
    user_id: string;
    percentage?: number;
    amount?: number;
  }[];
}

export async function updateTemplate(id: string, data: UpdateTemplateData) {
  const updatePayload: Record<string, unknown> = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.split_method !== undefined) updatePayload.split_method = data.split_method;
  if (data.participants !== undefined) updatePayload.participants = data.participants;

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
  const { error } = await supabase
    .from('split_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
