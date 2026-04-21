-- Auto-create a profiles row for every new auth.users insert.
-- Previously the client-side ensureProfile() handled this, but new accounts
-- created via admin.auth.admin.createUser (staff / customer / partner) had
-- no profile row until they logged in AND the hydrate path raced the insert —
-- which left the UI stuck on "loading".
-- This trigger guarantees a skeleton row exists the moment auth.users has
-- the user, regardless of how the account was provisioned.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
