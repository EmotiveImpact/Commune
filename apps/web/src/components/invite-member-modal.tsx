import { Modal, TextInput, Button, Stack } from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { inviteMemberSchema, type InviteMemberInput } from '@commune/core';
import { useInviteMember } from '../hooks/use-groups';

interface InviteMemberModalProps {
  opened: boolean;
  onClose: () => void;
  groupId: string;
}

export function InviteMemberModal({ opened, onClose, groupId }: InviteMemberModalProps) {
  const inviteMember = useInviteMember(groupId);

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
          <Button type="submit" loading={inviteMember.isPending} fullWidth>
            Send invitation
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
