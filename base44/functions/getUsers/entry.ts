import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const users = await base44.asServiceRole.entities.User.list();
    // Only expose public profile fields to other members
    const publicUsers = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || '',
      avatar_url: u.avatar_url || '',
    }));
    return Response.json({ users: publicUsers });
  } catch (err) {
    console.error('getUsers failed', err);
    return Response.json({ error: 'Could not load users' }, { status: 500 });
  }
});
