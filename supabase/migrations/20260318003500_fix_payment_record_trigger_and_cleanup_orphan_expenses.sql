CREATE OR REPLACE FUNCTION public.fn_create_payment_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_records (expense_id, user_id, amount, status)
  VALUES (NEW.expense_id, NEW.user_id, NEW.share_amount, 'unpaid')
  ON CONFLICT (expense_id, user_id)
  DO UPDATE SET amount = EXCLUDED.amount;

  RETURN NEW;
END;
$$;

UPDATE public.expenses AS expenses
SET is_active = false
WHERE expenses.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.expense_participants AS participants
    WHERE participants.expense_id = expenses.id
  );
