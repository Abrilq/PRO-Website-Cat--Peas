import { withSupabase } from '@supabase/server';

export const config = {
  runtime: 'edge',
};

export default withSupabase({ auth: 'user' }, async (_request, { userClaims }) => {
  if (!userClaims) {
    return Response.json({ message: 'Authentication required.' }, { status: 401 });
  }

  return Response.json({
    user: {
      id: userClaims.id,
      email: userClaims.email,
    },
  });
});
