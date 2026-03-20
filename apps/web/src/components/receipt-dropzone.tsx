import { useCallback, useRef, useState } from 'react';
import { ActionIcon, Group, Image, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCloudUpload, IconFile, IconPhoto, IconTrash, IconX } from '@tabler/icons-react';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

interface ReceiptDropzoneProps {
  /** Currently attached file (for create form) */
  value?: File | null;
  /** Callback when a file is selected or dropped */
  onChange: (file: File | null) => void;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Optional: existing receipt URL (for edit/detail view) */
  existingUrl?: string | null;
  /** Callback to delete an existing receipt */
  onDelete?: () => void;
  /** Whether delete is in progress */
  deleteLoading?: boolean;
  /** Whether upload is in progress */
  uploading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)/i.test(url);
}

export function ReceiptDropzone({
  value,
  onChange,
  disabled = false,
  existingUrl,
  onDelete,
  deleteLoading,
  uploading,
}: ReceiptDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const validateAndAccept = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        notifications.show({
          title: 'Invalid file type',
          message: 'Please upload an image (JPG, PNG, GIF, WebP) or PDF.',
          color: 'red',
        });
        return;
      }
      if (file.size > MAX_SIZE) {
        notifications.show({
          title: 'File too large',
          message: 'Please choose a file under 10 MB.',
          color: 'red',
        });
        return;
      }

      // Generate preview for images
      if (isImageFile(file)) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }

      onChange(file);
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled || uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndAccept(file);
    },
    [disabled, uploading, validateAndAccept],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !uploading) setDragOver(true);
    },
    [disabled, uploading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndAccept(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [validateAndAccept],
  );

  const handleClear = useCallback(() => {
    setPreview(null);
    onChange(null);
  }, [onChange]);

  // ── Existing receipt (detail/edit view) ──
  if (existingUrl) {
    return (
      <Paper
        className="commune-soft-panel"
        p="lg"
        radius="lg"
        style={{ border: '1px solid rgba(23, 27, 36, 0.08)' }}
      >
        <Stack gap="sm">
          {isImageUrl(existingUrl) && (
            <a href={existingUrl} target="_blank" rel="noopener noreferrer">
              <Image
                src={existingUrl}
                alt="Receipt"
                radius="md"
                maw={400}
                mah={300}
                fit="contain"
                style={{ cursor: 'pointer' }}
              />
            </a>
          )}
          <Group justify="space-between">
            <Group gap="xs">
              <IconFile size={16} style={{ color: '#667085' }} />
              <Text
                size="sm"
                fw={500}
                component="a"
                href={existingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2d6a4f', textDecoration: 'underline' }}
              >
                View receipt
              </Text>
            </Group>
            {onDelete && (
              <Tooltip label="Delete receipt">
                <ActionIcon
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={onDelete}
                  loading={deleteLoading}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Stack>
      </Paper>
    );
  }

  // ── Selected file preview (create form) ──
  if (value) {
    return (
      <Paper
        p="lg"
        radius="lg"
        style={{
          border: '1.5px solid rgba(45, 106, 79, 0.3)',
          backgroundColor: 'rgba(45, 106, 79, 0.04)',
        }}
      >
        <Stack gap="sm">
          {preview && (
            <Image
              src={preview}
              alt="Receipt preview"
              radius="md"
              maw={400}
              mah={200}
              fit="contain"
            />
          )}
          <Group justify="space-between">
            <Group gap="xs">
              {isImageFile(value) ? (
                <IconPhoto size={16} style={{ color: '#2d6a4f' }} />
              ) : (
                <IconFile size={16} style={{ color: '#2d6a4f' }} />
              )}
              <div>
                <Text size="sm" fw={500} lineClamp={1}>
                  {value.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatFileSize(value.size)}
                </Text>
              </div>
            </Group>
            <Tooltip label="Remove">
              <ActionIcon variant="subtle" color="gray" onClick={handleClear}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>
      </Paper>
    );
  }

  // ── Dropzone (empty state) ──
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      <Paper
        p="xl"
        radius="lg"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#2d6a4f' : 'rgba(23, 27, 36, 0.14)'}`,
          backgroundColor: dragOver
            ? 'rgba(45, 106, 79, 0.06)'
            : uploading
              ? 'rgba(23, 27, 36, 0.03)'
              : 'transparent',
          cursor: disabled || uploading ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
          textAlign: 'center',
        }}
      >
        <Stack align="center" gap="xs">
          <IconCloudUpload
            size={36}
            style={{
              color: dragOver ? '#2d6a4f' : '#667085',
              transition: 'color 0.15s ease',
            }}
          />
          <Text fw={600} size="sm" style={{ color: dragOver ? '#2d6a4f' : '#171b24' }}>
            {uploading
              ? 'Uploading...'
              : dragOver
                ? 'Drop to attach'
                : 'Drop a receipt here or click to browse'}
          </Text>
          <Text size="xs" c="dimmed">
            JPG, PNG, GIF, WebP, or PDF · Max 10 MB
          </Text>
        </Stack>
      </Paper>
    </>
  );
}
