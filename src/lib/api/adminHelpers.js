// Helpers to attach profile rows to query results without using PostgREST
// nested embeds. Avoids the implicit INNER JOIN that drops rows when admin
// can't read other users' profiles via RLS.

async function fetchProfilesByIds(supabase, userIds) {
  if (userIds.length === 0) return {}
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)
  return Object.fromEntries((profiles || []).map(p => [p.id, p]))
}

// Top-level: each row has user_id; attach `profiles` key to each.
// Returns a NEW array of new objects (immutable).
export async function attachProfiles(supabase, rows, userIdKey = 'user_id') {
  if (!rows || rows.length === 0) return rows || []
  const userIds = [...new Set(rows.map(r => r?.[userIdKey]).filter(Boolean))]
  const map = await fetchProfilesByIds(supabase, userIds)
  return rows.map(r => ({ ...r, profiles: map[r?.[userIdKey]] || null }))
}

// Single row variant — same behaviour, single object.
export async function attachProfile(supabase, row, userIdKey = 'user_id') {
  if (!row) return row
  const [withProfile] = await attachProfiles(supabase, [row], userIdKey)
  return withProfile
}

// Nested: each row has a nested object (e.g. customer_qa.customer_profiles)
// and the nested object has user_id. Attach `profiles` to the nested object.
// Returns a NEW array.
export async function attachNestedProfiles(supabase, rows, nestedKey, userIdKey = 'user_id') {
  if (!rows || rows.length === 0) return rows || []
  const userIds = [...new Set(
    rows.map(r => r?.[nestedKey]?.[userIdKey]).filter(Boolean)
  )]
  const map = await fetchProfilesByIds(supabase, userIds)
  return rows.map(r => {
    if (!r?.[nestedKey]) return r
    return {
      ...r,
      [nestedKey]: { ...r[nestedKey], profiles: map[r[nestedKey][userIdKey]] || null },
    }
  })
}
