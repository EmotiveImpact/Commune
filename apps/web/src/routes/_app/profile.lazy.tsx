import { createLazyFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCamera,
  IconDeviceFloppy,
  IconEdit,
  IconLink,
  IconPhone,
  IconPlus,
  IconStar,
  IconTrash,
  IconUser,
  IconWallet,
  IconMail,
  IconMapPin,
  IconClock,
  IconCheck,
  IconRosetteDiscountCheckFilled,
  IconAdjustmentsHorizontal,
  IconCreditCard,
  IconBell,
  IconLock,
  IconAlertTriangle,
  IconArrowsExchange,
  IconCash,
  IconReceipt,
  IconChartBar,
  IconSpeakerphone,
  IconDownload,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { updateProfileSchema, isClickableProvider, getProviderDisplayName } from '@commune/core';
import { PaymentProvider } from '@commune/types';
import type { UserPaymentMethod } from '@commune/types';
import { formatDate } from '@commune/utils';
import { uploadAvatar } from '@commune/api';
import { useAuthStore } from '../../stores/auth';
import { useProfile, useUpdateProfile } from '../../hooks/use-profile';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from '../../hooks/use-payment-methods';
import { SettingsSkeleton } from '../../components/page-skeleton';
import { PageHeader } from '../../components/page-header';
import { QueryErrorState } from '../../components/query-error-state';
import '../../account.css';

export const Route = createLazyFileRoute('/_app/profile')({
  component: ProfilePage,
});

const COUNTRY_OPTIONS = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'KE', label: 'Kenya' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
  { value: 'NZ', label: 'New Zealand' },
];

export function ProfilePage() {
  useEffect(() => {
    setPageTitle('Profile');
  }, []);

  const { user, isLoading: authLoading } = useAuthStore();
  const {
    data: profile,
    error: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const {
    data: paymentMethods = [],
    isError: isPaymentMethodsError,
    error: paymentMethodsError,
    refetch: refetchPaymentMethods,
  } = usePaymentMethods(user?.id ?? '');
  const createMethod = useCreatePaymentMethod(user?.id ?? '');
  const updateMethod = useUpdatePaymentMethod(user?.id ?? '');
  const deleteMethod = useDeletePaymentMethod(user?.id ?? '');
  const [methodModalOpened, { open: openMethodModal, close: closeMethodModal }] = useDisclosure(false);
  const [editingMethod, setEditingMethod] = useState<UserPaymentMethod | null>(null);
  const lastHydratedProfileRef = useRef<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Local UI state for the preference + notification sections (display today;
  // persistence wires into the settings backend next).
  const [prefs, setPrefs] = useState({ currency: 'GBP', timezone: 'Europe/London', language: 'en-GB', weekStart: 'monday' });
  const [notif, setNotif] = useState({
    newExpense: true, settleUp: true, reminders: true, recurring: true, weekly: false, product: false,
  });

  const resolvedProfile = useMemo(
    () => profile ?? (user ? {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      phone: user.phone ?? null,
      country: user.country ?? null,
      created_at: user.created_at,
    } : null),
    [profile, user],
  );

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      first_name: '',
      last_name: '',
      avatar_url: '' as string | null,
      phone: '' as string | null,
      country: '' as string | null,
    },
    validate: schemaResolver(updateProfileSchema),
  });

  useEffect(() => {
    if (resolvedProfile) {
      const hydrationKey = JSON.stringify({
        id: resolvedProfile.id,
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        phone: resolvedProfile.phone,
        country: resolvedProfile.country,
      });

      if (lastHydratedProfileRef.current === hydrationKey) return;
      lastHydratedProfileRef.current = hydrationKey;

      form.setValues({
        first_name: resolvedProfile.first_name,
        last_name: resolvedProfile.last_name,
        avatar_url: resolvedProfile.avatar_url ?? '',
        phone: resolvedProfile.phone ?? '',
        country: resolvedProfile.country ?? '',
      });
    }
  }, [resolvedProfile, form]);

  if (authLoading || (user && profileLoading && !resolvedProfile)) {
    return <SettingsSkeleton />;
  }

  if (!user) {
    return (
      <Paper className="commune-soft-panel" p="xl">
        <Text fw={600}>Your session is not ready yet.</Text>
        <Text size="sm" c="dimmed">
          Refresh the page or sign in again if this keeps happening.
        </Text>
      </Paper>
    );
  }

  if (profileError) {
    return (
      <QueryErrorState
        title="Failed to load profile"
        error={profileError}
        onRetry={() => {
          void refetchProfile();
        }}
        icon={IconUser}
      />
    );
  }

  if (!resolvedProfile) {
    return (
      <Paper className="commune-soft-panel" p="xl">
        <Text fw={600}>Could not load profile.</Text>
        <Text size="sm" c="dimmed">
          Refresh the page or sign in again if this keeps happening.
        </Text>
        <Button variant="light" mt="md" onClick={() => void refetchProfile()}>
          Retry
        </Button>
      </Paper>
    );
  }

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    try {
      await updateProfile.mutateAsync({
        userId: user!.id,
        data: {
          first_name: values.first_name,
          last_name: values.last_name,
          avatar_url: values.avatar_url || null,
          phone: values.phone || null,
          country: values.country || null,
        },
      });
      notifications.show({
        title: 'Profile saved',
        message: 'Your profile has been updated.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to save profile',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      notifications.show({
        title: 'File too large',
        message: 'Please choose an image under 1 MB.',
        color: 'red',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      notifications.show({
        title: 'Invalid file type',
        message: 'Please choose a JPG, PNG, or WebP image.',
        color: 'red',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadAvatar(user.id, file);
      form.setFieldValue('avatar_url', publicUrl);
      await updateProfile.mutateAsync({
        userId: user.id,
        data: { avatar_url: publicUrl },
      });
      notifications.show({
        title: 'Profile picture updated',
        message: 'Your new avatar is live.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Upload failed',
        message: err instanceof Error ? err.message : 'Could not upload image. Try again.',
        color: 'red',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <div className="commune-account">
      {/* Cover */}
      <div className="cover">
        <div className="cover-img" />
      </div>

      {/* Identity header */}
      <div className="id">
        <div
          className="id-av"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          style={{ cursor: 'pointer', opacity: isUploadingAvatar ? 0.6 : 1 }}
        >
          {form.getValues().avatar_url ? (
            <img src={form.getValues().avatar_url || undefined} alt="" />
          ) : (
            `${(form.getValues().first_name?.[0] ?? '').toUpperCase()}${(form.getValues().last_name?.[0] ?? '').toUpperCase()}` || '🙂'
          )}
          <span className="cam"><IconCamera size={14} /></span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatarUpload(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="id-meta">
          <div className="id-name">
            <h1>{`${form.getValues().first_name} ${form.getValues().last_name}`.trim() || 'Your profile'}</h1>
            <span className="verified"><IconRosetteDiscountCheckFilled size={13} /> Verified</span>
          </div>
          <div className="id-sub">
            <span className="mi"><IconMail size={14} /> {resolvedProfile.email}</span>
            {resolvedProfile.country ? <span className="mi"><IconMapPin size={14} /> {resolvedProfile.country}</span> : null}
            <span className="mi"><IconClock size={14} /> Member since {formatDate(resolvedProfile.created_at)}</span>
          </div>
        </div>
        <div className="id-actions">
          <button type="submit" form="profile-form" className="abtn pri" disabled={updateProfile.isPending}>
            <IconCheck size={16} /> Save changes
          </button>
        </div>
      </div>

      <div className="acc-grid">
        <nav className="snav">
          <div className="nlab">Account</div>
          <a href="#profile" className="on"><span className="si"><IconUser size={16} /></span> Profile</a>
          <a href="#preferences"><span className="si"><IconAdjustmentsHorizontal size={16} /></span> Preferences</a>
          <a href="#payment"><span className="si"><IconCreditCard size={16} /></span> Payment methods</a>
          <div className="nlab">System</div>
          <a href="#notifications"><span className="si"><IconBell size={16} /></span> Notifications</a>
          <a href="#security"><span className="si"><IconLock size={16} /></span> Security</a>
          <a href="#danger"><span className="si"><IconAlertTriangle size={16} /></span> Danger zone</a>
        </nav>

        <div className="col">
          {/* PROFILE */}
          <section className="section" id="profile">
            <div className="section-h">
              <h2>Profile</h2>
              <p>Your personal details, shown to others in your households.</p>
            </div>
            <form id="profile-form" onSubmit={form.onSubmit(handleSubmit)}>
              <div className="scard">
                <div className="frow">
                  <div>
                    <div className="lab">Full name</div>
                    <div className="hint">Appears on expenses, settle-up requests and member lists.</div>
                  </div>
                  <div className="ctl">
                    <div className="two-up">
                      <div className="field">
                        <label>First name</label>
                        <input className="inp" placeholder="First name" key={form.key('first_name')} {...form.getInputProps('first_name')} />
                      </div>
                      <div className="field">
                        <label>Last name</label>
                        <input className="inp" placeholder="Last name" key={form.key('last_name')} {...form.getInputProps('last_name')} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="frow">
                  <div>
                    <div className="lab">Email address</div>
                    <div className="hint">Used to sign in and receive receipts. Verified — contact support to change.</div>
                  </div>
                  <div className="ctl">
                    <div className="inp-icon">
                      <span className="il"><IconMail size={15} /></span>
                      <input className="inp ro" value={resolvedProfile.email} readOnly />
                      <span className="ir"><span className="abadge green dot">Verified</span></span>
                    </div>
                  </div>
                </div>

                <div className="frow">
                  <div>
                    <div className="lab">Phone number</div>
                    <div className="hint">For settle-up reminders and account recovery. Never shared publicly.</div>
                  </div>
                  <div className="ctl">
                    <div className="field">
                      <label>Mobile</label>
                      <input className="inp" placeholder="+44 7700 900000" key={form.key('phone')} {...form.getInputProps('phone')} />
                    </div>
                  </div>
                </div>

                <div className="frow">
                  <div>
                    <div className="lab">Country</div>
                    <div className="hint">Sets your region for tax categories and date formatting.</div>
                  </div>
                  <div className="ctl">
                    <select className="inp sel" key={form.key('country')} {...form.getInputProps('country')}>
                      <option value="">Select your country…</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </form>
          </section>

          {/* PREFERENCES */}
          <section className="section" id="preferences">
            <div className="section-h">
              <h2>Preferences</h2>
              <p>Currency, language and how dates &amp; times appear.</p>
            </div>
            <div className="scard">
              <div className="frow">
                <div>
                  <div className="lab">Default currency</div>
                  <div className="hint">New expenses default to this. Each household can override it.</div>
                </div>
                <div className="ctl">
                  <select className="inp sel" value={prefs.currency} onChange={(e) => setPrefs((p) => ({ ...p, currency: e.currentTarget.value }))}>
                    <option value="GBP">£  British Pound (GBP)</option>
                    <option value="EUR">€  Euro (EUR)</option>
                    <option value="USD">$  US Dollar (USD)</option>
                    <option value="NGN">₦  Nigerian Naira (NGN)</option>
                  </select>
                </div>
              </div>
              <div className="frow">
                <div>
                  <div className="lab">Timezone</div>
                  <div className="hint">Reminders and recurring bills run on this clock.</div>
                </div>
                <div className="ctl">
                  <select className="inp sel" value={prefs.timezone} onChange={(e) => setPrefs((p) => ({ ...p, timezone: e.currentTarget.value }))}>
                    <option value="Europe/London">(GMT+00:00) London</option>
                    <option value="Europe/Berlin">(GMT+01:00) Berlin, Paris</option>
                    <option value="America/New_York">(GMT−05:00) New York</option>
                    <option value="Africa/Lagos">(GMT+01:00) Lagos</option>
                  </select>
                </div>
              </div>
              <div className="frow">
                <div>
                  <div className="lab">First day of the week</div>
                  <div className="hint">Used across calendars and the recurring-bill schedule.</div>
                </div>
                <div className="ctl">
                  <div className="seg">
                    <button type="button" className={prefs.weekStart === 'monday' ? 'on' : ''} onClick={() => setPrefs((p) => ({ ...p, weekStart: 'monday' }))}>Monday</button>
                    <button type="button" className={prefs.weekStart === 'sunday' ? 'on' : ''} onClick={() => setPrefs((p) => ({ ...p, weekStart: 'sunday' }))}>Sunday</button>
                    <button type="button" className={prefs.weekStart === 'saturday' ? 'on' : ''} onClick={() => setPrefs((p) => ({ ...p, weekStart: 'saturday' }))}>Saturday</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* PAYMENT METHODS */}
          <section className="section" id="payment">
            <div className="section-h">
              <h2>Payment methods</h2>
              <p>How housemates settle up with you. Commune never moves money — these route them to your app.</p>
            </div>
            {isPaymentMethodsError ? (
              <QueryErrorState
                title="Failed to load payment methods"
                error={paymentMethodsError}
                onRetry={() => { void refetchPaymentMethods(); }}
                icon={IconWallet}
              />
            ) : (
              <div className="scard">
                {paymentMethods.length === 0 && (
                  <div className="pm"><div className="pm-bd"><div className="s">No payment methods yet. Add one so members can pay you.</div></div></div>
                )}
                {paymentMethods.map((method) => (
                  <div className={`pm${method.is_default ? ' pm-default' : ''}`} key={method.id}>
                    <div className="pm-logo">{getProviderDisplayName(method.provider as PaymentProvider).charAt(0)}</div>
                    <div className="pm-bd">
                      <div className="t">
                        {getProviderDisplayName(method.provider as PaymentProvider)}
                        {method.is_default && <span className="abadge green dot">Default</span>}
                        {method.label && <span className="abadge neutral">{method.label}</span>}
                      </div>
                      <div className="s">{method.payment_link || method.payment_info || 'No details set'}</div>
                    </div>
                    <div className="pm-act">
                      {!method.is_default && (
                        <button type="button" className="linkbtn" onClick={() => updateMethod.mutate({ methodId: method.id, data: { is_default: true } }, { onSuccess: () => notifications.show({ title: 'Default updated', message: `${getProviderDisplayName(method.provider as PaymentProvider)} is now your default.`, color: 'green' }) })}>Make default</button>
                      )}
                      <button type="button" className="linkbtn" onClick={() => { setEditingMethod(method); openMethodModal(); }}>Edit</button>
                      <button type="button" className="linkbtn del" onClick={() => { if (window.confirm('Remove this payment method?')) { deleteMethod.mutate(method.id, { onSuccess: () => notifications.show({ title: 'Payment method removed', message: `${getProviderDisplayName(method.provider as PaymentProvider)} has been removed.`, color: 'green' }) }); } }}>Remove</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="pm-add" onClick={() => { setEditingMethod(null); openMethodModal(); }}><IconPlus size={16} /> Add a payment method</button>
              </div>
            )}
          </section>

          {/* NOTIFICATIONS */}
          <section className="section" id="notifications">
            <div className="section-h">
              <h2>Notifications</h2>
              <p>Choose what reaches you.</p>
            </div>
            <div className="scard">
              {([
                { k: 'newExpense', Icon: IconCash, t: 'New expense added', s: "When a housemate logs a shared cost you're part of." },
                { k: 'settleUp', Icon: IconArrowsExchange, t: 'Settle-up requests', s: 'Someone asks you to pay, or marks a debt as settled.' },
                { k: 'reminders', Icon: IconClock, t: 'Payment reminders', s: 'Nudges when you owe money or a bill is overdue.' },
                { k: 'recurring', Icon: IconReceipt, t: 'Recurring bills due', s: 'A heads-up before rent, utilities or subscriptions post.' },
                { k: 'weekly', Icon: IconChartBar, t: 'Weekly summary', s: 'A Monday digest of household spending and balances.' },
                { k: 'product', Icon: IconSpeakerphone, t: 'Product updates & tips', s: 'Occasional news about new Commune features.' },
              ] as const).map((row) => (
                <div className="nrow" key={row.k}>
                  <div className="ni"><row.Icon size={17} /></div>
                  <div className="nb"><div className="t">{row.t}</div><div className="s">{row.s}</div></div>
                  <label className="toggle">
                    <input type="checkbox" checked={notif[row.k]} onChange={(e) => setNotif((n) => ({ ...n, [row.k]: e.currentTarget.checked }))} />
                    <span className="tk" />
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* SECURITY */}
          <section className="section" id="security">
            <div className="section-h">
              <h2>Security</h2>
              <p>Keep your account locked down.</p>
            </div>
            <div className="scard">
              <div className="frow">
                <div>
                  <div className="lab">Password</div>
                  <div className="hint">Use 12+ characters with a mix of symbols. You'll be signed out of other devices after changing.</div>
                </div>
                <div className="ctl">
                  <div className="two-up">
                    <div className="field"><label>New password</label><input className="inp" type="password" placeholder="••••••••••••" /></div>
                    <div className="field"><label>Confirm new</label><input className="inp" type="password" placeholder="••••••••••••" /></div>
                  </div>
                  <button type="button" className="abtn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => notifications.show({ title: 'Password reset', message: 'Use “Forgot password” on the login screen to set a new one securely.', color: 'blue' })}>Update password</button>
                </div>
              </div>
              <div className="frow">
                <div>
                  <div className="lab">Two-factor authentication</div>
                  <div className="hint">Require a code from your authenticator app at sign-in.</div>
                </div>
                <div className="ctl" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <span className="abadge neutral">Not set up</span>
                  <button type="button" className="abtn ghost sm" onClick={() => notifications.show({ title: 'Coming soon', message: 'Two-factor setup is on the way.', color: 'blue' })}>Enable</button>
                </div>
              </div>
            </div>
          </section>

          {/* DANGER ZONE */}
          <section className="section" id="danger">
            <div className="danger-zone">
              <div className="dz-h">
                <div className="dz-ic"><IconAlertTriangle size={17} /></div>
                <h2>Danger zone</h2>
              </div>
              <div className="dz-row">
                <div className="dz-bd">
                  <div className="t">Export your data</div>
                  <div className="s">Download a copy of your expenses, balances and payment history as CSV.</div>
                </div>
                <button type="button" className="abtn ghost" onClick={() => notifications.show({ title: 'Export requested', message: "We'll email you a download link shortly.", color: 'green' })}><IconDownload size={16} /> Export data</button>
              </div>
              <div className="dz-row">
                <div className="dz-bd">
                  <div className="t">Delete account</div>
                  <div className="s">Permanently erase your account and personal data. This cannot be undone, and any debts you owe remain visible to housemates.</div>
                </div>
                <button type="button" className="abtn danger" onClick={() => notifications.show({ title: 'Confirm via support', message: 'For your safety, account deletion is confirmed with support — contact us to proceed.', color: 'red' })}>Delete account</button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="savebar">
        <span className="sv-dot" />
        <span className="sv-t">Changes to your profile aren't saved until you hit save.</span>
        <span className="sv-sp" />
        <button type="submit" form="profile-form" className="abtn pri" disabled={updateProfile.isPending}><IconCheck size={16} /> Save changes</button>
      </div>

      {/* ── Add / Edit payment method modal ── */}
      <PaymentMethodModal
        opened={methodModalOpened}
        onClose={() => {
          closeMethodModal();
          setEditingMethod(null);
        }}
        editing={editingMethod}
        onCreate={(data) => {
          createMethod.mutate(data, {
            onSuccess: () => {
              closeMethodModal();
              notifications.show({ title: 'Payment method added', message: 'Your new payment method is saved.', color: 'green' });
            },
            onError: (err) => {
              notifications.show({ title: 'Failed to add method', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' });
            },
          });
        }}
        onUpdate={(methodId, data) => {
          updateMethod.mutate({ methodId, data }, {
            onSuccess: () => {
              closeMethodModal();
              setEditingMethod(null);
              notifications.show({ title: 'Payment method updated', message: 'Changes saved.', color: 'green' });
            },
            onError: (err) => {
              notifications.show({ title: 'Failed to update method', message: err instanceof Error ? err.message : 'Something went wrong', color: 'red' });
            },
          });
        }}
        isLoading={createMethod.isPending || updateMethod.isPending}
      />
    </div>
  );
}

// ─── Payment Method Modal ───────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: 'revolut', label: 'Revolut' },
  { value: 'monzo', label: 'Monzo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'wise', label: 'Wise' },
  { value: 'starling', label: 'Starling Bank' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cash_app', label: 'Cash App' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

function PaymentMethodModal({
  opened,
  onClose,
  editing,
  onCreate,
  onUpdate,
  isLoading,
}: {
  opened: boolean;
  onClose: () => void;
  editing: UserPaymentMethod | null;
  onCreate: (data: {
    provider: string;
    label?: string | null;
    payment_link?: string | null;
    payment_info?: string | null;
    is_default?: boolean;
  }) => void;
  onUpdate: (methodId: string, data: {
    provider?: string;
    label?: string | null;
    payment_link?: string | null;
    payment_info?: string | null;
    is_default?: boolean;
  }) => void;
  isLoading: boolean;
}) {
  const [provider, setProvider] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [link, setLink] = useState('');
  const [info, setInfo] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Reset form when modal opens/editing changes
  useEffect(() => {
    if (opened) {
      if (editing) {
        setProvider(editing.provider);
        setLabel(editing.label ?? '');
        setLink(editing.payment_link ?? '');
        setInfo(editing.payment_info ?? '');
        setIsDefault(editing.is_default);
      } else {
        setProvider(null);
        setLabel('');
        setLink('');
        setInfo('');
        setIsDefault(false);
      }
    }
  }, [opened, editing]);

  const showLink = provider && isClickableProvider(provider as PaymentProvider);
  const showInfo = provider && !isClickableProvider(provider as PaymentProvider);

  function handleSubmit() {
    if (!provider) return;
    if (showLink && !link.trim()) {
      notifications.show({
        title: 'Payment link required',
        message: `Add your ${getProviderDisplayName(provider as PaymentProvider)} username or link.`,
        color: 'red',
      });
      return;
    }

    if (showInfo && !info.trim()) {
      notifications.show({
        title: 'Payment details required',
        message: 'Add the payment details members should use when settling up.',
        color: 'red',
      });
      return;
    }

    const data = {
      provider,
      label: label || null,
      payment_link: link || null,
      payment_info: info || null,
      is_default: isDefault,
    };
    if (editing) {
      onUpdate(editing.id, data);
    } else {
      onCreate(data);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? 'Edit payment method' : 'Add payment method'}
      size="md"
    >
      <Stack gap="md">
        <Select
          label="Provider"
          placeholder="Select provider"
          data={PROVIDER_OPTIONS}
          value={provider}
          onChange={(val) => {
            setProvider(val);
            setLink('');
            setInfo('');
          }}
          required
        />

        {provider && (
          <TextInput
            label="Label (optional)"
            placeholder={`e.g. Personal ${getProviderDisplayName(provider as PaymentProvider)}`}
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
        )}

        {showLink && (
          <TextInput
            label={
              provider === 'revolut' ? 'Revolut.me username'
              : provider === 'monzo' ? 'Monzo.me username'
              : provider === 'paypal' ? 'PayPal.me username'
              : provider === 'wise' ? 'Wise pay link or username'
              : provider === 'starling' ? 'Starling Settle Up username'
              : provider === 'venmo' ? 'Venmo username'
              : provider === 'cash_app' ? 'Cash App $cashtag'
              : 'Payment link or username'
            }
            description={
              provider === 'revolut' ? 'e.g. johndoe or revolut.me/johndoe'
              : provider === 'monzo' ? 'e.g. johndoe or monzo.me/johndoe'
              : provider === 'paypal' ? 'e.g. johndoe or paypal.me/johndoe'
              : provider === 'wise' ? 'e.g. johndoe or wise.com/pay/johndoe'
              : provider === 'starling' ? 'e.g. johndoe'
              : provider === 'venmo' ? 'e.g. johndoe or venmo.com/johndoe'
              : provider === 'cash_app' ? 'e.g. $johndoe or cash.app/$johndoe'
              : 'Enter a link or username'
            }
            placeholder={provider === 'cash_app' ? '$johndoe' : 'johndoe'}
            leftSection={<IconLink size={16} />}
            value={link}
            onChange={(e) => setLink(e.currentTarget.value)}
          />
        )}

        {showInfo && (
          <Textarea
            label="Payment details"
            description="Your bank details or payment instructions"
            placeholder="e.g. Sort: 12-34-56, Account: 12345678"
            autosize
            minRows={2}
            maxRows={4}
            value={info}
            onChange={(e) => setInfo(e.currentTarget.value)}
          />
        )}

        {provider && (
          <Switch
            label="Set as default"
            description="This will be shown first when members settle up"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.currentTarget.checked)}
          />
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!provider}
            loading={isLoading}
          >
            {editing ? 'Save changes' : 'Add method'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
