import { supabase } from './client';

/**
 * Upload a receipt file to Supabase storage and return the public URL.
 * Files are stored under `receipts/{userId}/{expenseId}/{filename}`.
 */
export async function uploadReceipt(
  file: File,
  userId: string,
  expenseId: string,
): Promise<string> {
  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    throw new Error('File must be under 10 MB.');
  }

  // Sanitize extension: lowercase, strip anything non-alphanumeric, cap at 10
  // chars so a malicious filename can't poison the storage path.
  const rawExt = file.name.split('.').pop() ?? 'jpg';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
  const sanitizedName = `receipt.${ext}`;
  const folder = `${userId}/${expenseId}`;
  const filePath = `${folder}/${sanitizedName}`;

  // Remove any pre-existing receipt files in the folder (different extensions
  // from a prior upload, e.g. `receipt.pdf` left behind when replacing with
  // `receipt.jpg`). `upsert: true` only overwrites the exact same path, so
  // without this step we'd orphan the old file and leak storage.
  const { data: existing } = await supabase.storage.from('receipts').list(folder);
  if (existing && existing.length > 0) {
    const stalePaths = existing
      .map((entry) => `${folder}/${entry.name}`)
      .filter((p) => p !== filePath);
    if (stalePaths.length > 0) {
      await supabase.storage.from('receipts').remove(stalePaths);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);

  // Append cache-buster so the browser picks up new uploads immediately
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  // Update the expense with the receipt URL
  const { error: updateError } = await supabase
    .from('expenses')
    .update({ receipt_url: publicUrl })
    .eq('id', expenseId);

  if (updateError) throw updateError;

  return publicUrl;
}

/**
 * Delete a receipt from storage and clear the receipt_url on the expense.
 */
export async function deleteReceipt(expenseId: string): Promise<void> {
  // First get the current receipt_url to determine the storage path
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('receipt_url')
    .eq('id', expenseId)
    .single();

  if (fetchError) throw fetchError;
  if (!expense?.receipt_url) return;

  // Extract the storage path from the public URL
  // Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/receipts/<path>?t=...
  const url = new URL(expense.receipt_url);
  const pathParts = url.pathname.split('/storage/v1/object/public/receipts/');
  if (pathParts.length === 2) {
    const storagePath = decodeURIComponent(pathParts[1]!);
    await supabase.storage.from('receipts').remove([storagePath]);
  }

  // Clear the receipt_url on the expense
  const { error: updateError } = await supabase
    .from('expenses')
    .update({ receipt_url: null })
    .eq('id', expenseId);

  if (updateError) throw updateError;
}

/**
 * Get the receipt URL for an expense.
 */
export async function getReceiptUrl(expenseId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select('receipt_url')
    .eq('id', expenseId)
    .single();

  if (error) throw error;
  return (data as { receipt_url: string | null }).receipt_url;
}
