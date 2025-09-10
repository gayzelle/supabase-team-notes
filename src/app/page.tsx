'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Org = { id: string; name: string }
type Note = { id: string; title: string; content: string; org_id: string; updated_at: string }
type Attachment = { path: string }

export default function Home() {
const [email, setEmail] = useState('')
const [user, setUser] = useState<any>(null)
const [orgs, setOrgs] = useState<Org[]>([])
const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
const [notes, setNotes] = useState<Note[]>([])
const [attachments, setAttachments] = useState<Attachment[]>([])
const [title, setTitle] = useState('')
const [content, setContent] = useState('')
const [file, setFile] = useState<File | null>(null)

useEffect(() => {
const init = async () => {
const { data: { user } } = await supabase.auth.getUser()
setUser(user)
if (user) await loadOrgs()
}
init()
const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
setUser(session?.user ?? null)
if (session?.user) loadOrgs()
})
return () => sub.subscription.unsubscribe()
}, [])

useEffect(() => {
if (!selectedOrg) return
loadNotes(selectedOrg)
loadAttachments(selectedOrg)
const channel = supabase
.channel('notes')
.on('postgres_changes',
{ event: '*', schema: 'public', table: 'notes', filter: org_id=eq.${selectedOrg} },
() => loadNotes(selectedOrg)
)
.subscribe()
return () => { supabase.removeChannel(channel) }
}, [selectedOrg])

const signIn = async () => {
const { error } = await supabase.auth.signInWithOtp({
email,
options: { emailRedirectTo: window.location.origin }
})
if (error) alert(error.message)
else alert('Magic link sent! Open Inbucket at http://localhost:54324 to click it (local dev).')
}

const signOut = async () => {
await supabase.auth.signOut()
setSelectedOrg(null); setOrgs([]); setNotes([]); setAttachments([])
}

const createOrg = async () => {
if (!user) return
const name = prompt('Org name?')
if (!name) return
const { data: org, error: e1 } = await supabase.from('orgs').insert({
name, owner_id: user.id
}).select().single()
if (e1) return alert(e1.message)
const { error: e2 } = await supabase.from('memberships').insert({
org_id: org.id, user_id: user.id, role: 'owner'
})
if (e2) return alert(e2.message)
await loadOrgs()
setSelectedOrg(org.id)
}

const loadOrgs = async () => {
if (!user) return
const { data, error } = await supabase
.from('orgs')
.select('id,name, memberships!inner(user_id)')
.eq('memberships.user_id', user.id)
.order('name')
if (error) { console.error(error); return }
setOrgs(data.map((o: any) => ({ id: o.id, name: o.name })))
if (data.length && !selectedOrg) setSelectedOrg(data[0].id)
}

const loadNotes = async (orgId: string) => {
const { data, error } = await supabase
.from('notes')
.select('*')
.eq('org_id', orgId)
.order('updated_at', { ascending: false })
if (error) { console.error(error); return }
setNotes(data as Note[])
}

const loadAttachments = async (orgId: string) => {
const { data, error } = await supabase
.from('attachments')
.select('path')
.eq('org_id', orgId)
.order('created_at', { ascending: false })
if (error) { console.error(error); return }
setAttachments((data ?? []) as Attachment[])
}

const addNote = async () => {
if (!selectedOrg || !user) return
const { error } = await supabase.from('notes').insert({
org_id: selectedOrg, author_id: user.id, title, content
})
if (error) alert(error.message)
else { setTitle(''); setContent('') }
}

const uploadFile = async () => {
if (!file || !selectedOrg || !user) return
const path = org/${selectedOrg}/${Date.now()}-${file.name}
const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
if (upErr) return alert(upErr.message)
const { error: recErr } = await supabase.from('attachments').insert({
note_id: notes[0]?.id ?? null,
org_id: selectedOrg,
path,
created_by: user.id
})
if (recErr) return alert(recErr.message)
await loadAttachments(selectedOrg)
alert('Uploaded!')
}

const openSignedUrl = async (path: string) => {
const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60)
if (error) return alert(error.message)
window.open(data.signedUrl, '_blank')
}

const callDigest = async () => {
const { data, error } = await supabase.functions.invoke('digest')
if (error) alert(error.message)
else alert(JSON.stringify(data))
}

if (!user) {
return (
<main style={{ padding: 20 }}>
<h2>Sign in</h2>
<input placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
<button onClick={signIn}>Send magic link</button>
</main>
)
}

return (
<main style={{ padding: 20, display: 'grid', gap: 16 }}>
<div>
<b>Signed in:</b> {user.email}
<button onClick={signOut} style={{ marginLeft: 12 }}>Sign out</button>
</div>

  <section>
    <h3>Organizations</h3>
    <button onClick={createOrg}>+ Create org</button>
    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {orgs.map(o => (
        <button key={o.id}
          onClick={() => setSelectedOrg(o.id)}
          style={{ background: selectedOrg === o.id ? '#eee' : '#fff' }}>
          {o.name}
        </button>
      ))}
    </div>
  </section>

  {selectedOrg && (
    <>
      <section>
        <h3>Notes</h3>
        <div style={{ display: 'grid', gap: 8, maxWidth: 600 }}>
          <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea placeholder="Content" value={content} onChange={e => setContent(e.target.value)} />
          <button onClick={addNote}>Add note</button>
        </div>
        <ul>
          {notes.map(n => (
            <li key={n.id} style={{ margin: '8px 0' }}>
              <b>{n.title}</b> — {new Date(n.updated_at).toLocaleString()}<br />
              {n.content}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Attachments</h3>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={uploadFile} disabled={!file}>Upload to this org</button>
        <ul>
          {attachments.map(a => (
            <li key={a.path}>
              {a.path} — <button onClick={() => openSignedUrl(a.path)}>Open signed URL</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Edge Function</h3>
        <button onClick={callDigest}>Call digest (JWT‑forwarded)</button>
      </section>
    </>
  )}
</main>
)
}
TSX

