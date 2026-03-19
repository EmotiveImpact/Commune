import { Modal, TextInput, Button, Stack, Alert, Anchor } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { inviteMemberSchema, type InviteMemberInput } from '@commune/core';
import { useInviteMember } from '../hooks/use-groups';
import { Link } from '@tanstack/react-router';
import { useAuthStore } from '../stores/auth';
import { usePlanLimits } from '../hooks/use-plan-limits';

interface InviteMemberModalProps {
  opened: boolean;
  onClose: () => void;
  groupId: string;
}

export function InviteMemberModal({ opened, onClose, groupId }: InviteMemberModalProps) {
  const inviteMember = useInviteMember(groupId);
  const { user } = useAuthStore();
  const { canInviteMember, memberLimit, currentMembers } = usePlanLimits(user?.id ?? '');

  const form = useForm<InviteMemberInput>({
    mode: 'uncontrolled',
    initialValues: { email: '' },
    validate: schemaResolver(inviteMemberSchema),
  });

  async function handleSubmit(values: InviteMemberInput) {
    try {
      await inviteMember.mutateAsync(values.email);
      notifications.show({
        title: 'Invitation sent',
        message: `Invited ${values.email} to the group`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (err) {
      notifications.show({
        title: 'Invitation failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Invite a member">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Email address"
            placeholder="member@example.com"
            withAsterisk
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          {!canInviteMember && (
            <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
              You've reached the member limit for your plan ({currentMembers}/{memberLimit === Infinity ? 'unlimited' : memberLimit}).{' '}
              <Anchor component={Link} to="/pricing" size="sm" fw={600}>
                Upgrade to invite more members.
              </Anchor>
            </Alert>
          )}
          <Button type="submit" loading={inviteMember.isPending} disabled={!canInviteMember} fullWidth>
            Send invitation
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
