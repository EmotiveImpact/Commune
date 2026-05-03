-- Split single "name" column into first_name + last_name
-- Keep "name" as a generated column for backward compatibility

ALTER TABLE public.users
  ADD COLUMN first_name text,
  ADD COLUMN last_name text;

-- Populate from existing name data
UPDATE public.users SET
  first_name = CASE
    WHEN position(' ' in name) > 0 THEN left(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END;

-- Make first_name required going forward
ALTER TABLE public.users
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN first_name SET DEFAULT '',
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN last_name SET DEFAULT '';

-- Drop old name column and recreate as generated
ALTER TABLE public.users DROP COLUMN name;
ALTER TABLE public.users
  ADD COLUMN name text GENERATED ALWAYS AS (
    CASE
      WHEN last_name = '' THEN first_name
      ELSE first_name || ' ' || last_name
    END
  ) STORED;
