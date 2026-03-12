import { User as SupabaseUser } from "@supabase/supabase-js"

declare global {
  namespace Express {
    interface Request {
      user: SupabaseUser
    }
    // Alternatively, we could augment Express.User to extend SupabaseUser:
    // interface User extends SupabaseUser {}
  }
}

export { }