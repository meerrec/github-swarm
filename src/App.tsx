import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, Bot, Check, CheckCircle2, ChevronDown, Circle, CircleDot, Clock3, Command, GitBranch, Github, GitPullRequest, LayoutDashboard, ListFilter, Menu, Pause, Play, Plus, Search, Settings2, Sparkles, Terminal, X, Zap } from 'lucide-react'

type TaskStatus = 'working' | 'review' | 'queued' | 'done'
type View = 'dashboard' | 'agents' | 'activity'
type Task = { id: number; title: string; repo: string; agent: string; branch: string; status: TaskStatus; progress: number; priority: 'High' | 'Medium' | 'Low'; labels: string[]; elapsed: string; description: string }
type Event = { id: number; agent: string; text: string; time: string; kind: 'success' | 'active' | 'info' }

const initialTasks: Task[] = [
  { id: 482, title: 'Fix OAuth callback race condition', repo: 'acme/platform', agent: 'Scout', branch: 'swarm/482-oauth-race', status: 'working', progress: 72, priority: 'High', labels: ['bug', 'auth'], elapsed: '18m', description: 'Investigate intermittent session loss during OAuth redirects, isolate the race condition and add regression coverage.' },
  { id: 479, title: 'Add retry policy to webhook delivery', repo: 'acme/platform', agent: 'Forge', branch: 'swarm/479-webhook-retries', status: 'working', progress: 46, priority: 'Medium', labels: ['enhancement', 'api'], elapsed: '31m', description: 'Implement exponential backoff and a bounded retry queue for failed webhook deliveries.' },
  { id: 476, title: 'Migrate settings page to new form API', repo: 'acme/dashboard', agent: 'Patch', branch: 'swarm/476-settings-forms', status: 'review', progress: 100, priority: 'Medium', labels: ['refactor', 'ui'], elapsed: '1h 04m', description: 'Move legacy settings forms to the shared form API without changing existing behavior.' },
  { id: 473, title: 'Document local development setup', repo: 'acme/docs', agent: 'Scribe', branch: 'swarm/473-local-setup', status: 'queued', progress: 0, priority: 'Low', labels: ['documentation'], elapsed: '—', description: 'Create a concise setup guide including prerequisites, environment variables and common failures.' },
  { id: 468, title: 'Reduce bundle size of analytics client', repo: 'acme/dashboard', agent: 'Forge', branch: 'swarm/468-analytics-bundle', status: 'done', progress: 100, priority: 'Medium', labels: ['performance'], elapsed: '42m', description: 'Split optional analytics integrations into lazy-loaded chunks and remove duplicate utilities.' },
]

const agentMeta = [
  { name: 'Scout', role: 'Investigation & tests', color: '#00d9a3', model: 'kimi-k2.5', load: 72 },
  { name: 'Forge', role: 'Implementation', color: '#69a7ff', model: 'kimi-k2.5', load: 46 },
  { name: 'Patch', role: 'Refactoring', color: '#d2a8ff', model: 'kimi-k2.5', load: 100 },
  { name: 'Scribe', role: 'Documentation', color: '#f2cc60', model: 'kimi-k2.5', load: 0 },
]

const initialEvents: Event[] = [
  { id: 1, agent: 'Patch', text: 'opened a pull request for #476', time: '2m', kind: 'success' },
  { id: 2, agent: 'Scout', text: 'added 3 regression tests', time: '5m', kind: 'active' },
  { id: 3, agent: 'Forge', text: 'running integration suite', time: '8m', kind: 'active' },
  { id: 4, agent: 'Scout', text: 'reproduced failure in auth callback', time: '14m', kind: 'info' },
  { id: 5, agent: 'System', text: 'assigned #479 to Forge', time: '31m', kind: 'info' },
]

const statusLabel: Record<TaskStatus, string> = { working: 'In progress', review: 'In review', queued: 'Queued', done: 'Completed' }
const avatarColor: Record<string, string> = { Scout: '#00d9a3', Forge: '#69a7ff', Patch: '#d2a8ff', Scribe: '#f2cc60', System: '#8b949e' }

function loadTasks() {
  try { return JSON.parse(localStorage.getItem('swarm-tasks') || 'null') || initialTasks } catch { return initialTasks }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [selectedId, setSelectedId] = useState(482)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(true)
  const [view, setView] = useState<View>('dashboard')
  const [modal, setModal] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newRepo, setNewRepo] = useState('acme/platform')
  const [newPriority, setNewPriority] = useState<Task['priority']>('Medium')

  useEffect(() => { localStorage.setItem('swarm-tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setTasks(prev => prev.map(t => t.status === 'working' ? { ...t, progress: Math.min(96, t.progress + 1) } : t))
    }, 7000)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(t)
  }, [toast])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setModal(false); setMobileNav(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selected = tasks.find(t => t.id === selectedId) || tasks[0]
  const visible = useMemo(() => tasks.filter(t => (filter === 'all' || t.status === filter) && `${t.title} ${t.repo} ${t.agent}`.toLowerCase().includes(query.toLowerCase())), [tasks, filter, query])
  const activeCount = tasks.filter(t => t.status === 'working').length
  const reviewCount = tasks.filter(t => t.status === 'review').length

  function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const id = Math.max(...tasks.map(t => t.id), 480) + 1
    const task: Task = { id, title: newTitle.trim(), repo: newRepo, agent: 'Scribe', branch: `swarm/${id}-new-task`, status: 'queued', progress: 0, priority: newPriority, labels: ['triage'], elapsed: '—', description: 'New task awaiting triage and agent assignment.' }
    setTasks(prev => [task, ...prev]); setSelectedId(id); setEvents(prev => [{ id: Date.now(), agent: 'System', text: `queued #${id} for triage`, time: 'now', kind: 'info' }, ...prev])
    setNewTitle(''); setModal(false); setView('dashboard'); setToast(`Task #${id} added to the queue`)
  }
  function toggleTask(id: number) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'queued' ? 'working' : t.status === 'working' ? 'queued' : t.status, progress: t.status === 'queued' ? 4 : t.progress } : t))
  }
  function completeTask(id: number) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done', progress: 100 } : t))
    setToast(`Task #${id} marked complete`)
  }

  const nav = (next: View) => { setView(next); setMobileNav(false) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Github size={20}/><i/></span><span>swarm</span><span className="beta">BETA</span><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20}/></button></div>
      <button className="workspace"><span className="workspace-icon">A</span><span><b>Acme Engineering</b><small>3 repositories</small></span><ChevronDown size={15}/></button>
      <nav className="main-nav" aria-label="Main navigation">
        <span className="nav-label">WORKSPACE</span>
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => nav('dashboard')}><LayoutDashboard size={17}/>Dashboard<span className="nav-count">{activeCount}</span></button>
        <button className={view === 'agents' ? 'active' : ''} onClick={() => nav('agents')}><Bot size={17}/>Agents<span className="nav-count">4</span></button>
        <button className={view === 'activity' ? 'active' : ''} onClick={() => nav('activity')}><Activity size={17}/>Activity</button>
        <span className="nav-label nav-second">REPOSITORIES</span>
        <button onClick={() => { nav('dashboard'); setQuery('acme/platform') }}><GitBranch size={17}/>acme/platform<span className="repo-dot"/></button>
        <button onClick={() => { nav('dashboard'); setQuery('acme/dashboard') }}><GitBranch size={17}/>acme/dashboard</button>
        <button onClick={() => { nav('dashboard'); setQuery('acme/docs') }}><GitBranch size={17}/>acme/docs</button>
      </nav>
      <div className="sidebar-bottom"><div className="usage"><div><span>Agent capacity</span><b>2 / 4</b></div><div className="capacity"><i/><i/><i className="off"/><i className="off"/></div><small>2 slots available</small></div><button className="profile" onClick={() => setToast('Workspace settings are managed by Acme Engineering')}><span className="avatar">AK</span><span><b>Alex Kim</b><small>Admin</small></span><Settings2 size={16}/></button></div>
    </aside>
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main>
      <header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="breadcrumbs"><span>Acme Engineering</span><b>/</b><strong>{view === 'dashboard' ? 'Dashboard' : view === 'agents' ? 'Agents' : 'Activity'}</strong></div><div className="top-actions"><span className="demo-badge"><CircleDot size={13}/>Demo workspace</span><a href="https://github.com" target="_blank" rel="noreferrer" className="icon-btn" aria-label="Open GitHub"><Github size={19}/></a></div></header>
      <div className="content">
        {view === 'dashboard' && <>
          <section className="page-heading"><div><div className="eyebrow"><span className={running ? 'live-dot' : 'live-dot paused'}/>{running ? 'SWARM ACTIVE' : 'SWARM PAUSED'}</div><h1>Good evening, Alex.</h1><p>Your agents are moving work forward across 3 repositories.</p></div><div className="heading-actions"><button className="btn secondary" onClick={() => { setRunning(!running); setToast(running ? 'Swarm paused' : 'Swarm resumed') }}>{running ? <Pause size={16}/> : <Play size={16}/>}<span>{running ? 'Pause swarm' : 'Resume swarm'}</span></button><button className="btn primary" onClick={() => setModal(true)}><Plus size={17}/>New task</button></div></section>
          <section className="metrics" aria-label="Workspace summary"><div><span className="metric-icon mint"><Zap size={17}/></span><p>Active agents</p><strong>{running ? activeCount : 0}<small> / 4</small></strong><span className="metric-note">{running ? 'Working now' : 'All agents paused'}</span></div><div><span className="metric-icon blue"><GitPullRequest size={17}/></span><p>Pull requests</p><strong>{reviewCount + 3}</strong><span className="metric-note"><b>+2</b> today</span></div><div><span className="metric-icon violet"><CheckCircle2 size={17}/></span><p>Tasks completed</p><strong>{tasks.filter(t => t.status === 'done').length + 14}</strong><span className="metric-note">This week</span></div><div><span className="metric-icon amber"><Clock3 size={17}/></span><p>Time saved</p><strong>26.4<small>h</small></strong><span className="metric-note"><b>↑ 18%</b> vs last week</span></div></section>
          <div className="dashboard-grid">
            <section className="task-panel">
              <div className="panel-head"><div><h2>Task queue</h2><span>{visible.length} tasks</span></div><button className="icon-btn" onClick={() => setFilter(filter === 'all' ? 'working' : 'all')} aria-label="Toggle active task filter"><ListFilter size={18}/></button></div>
              <div className="task-tools"><label className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks, repos, agents…" aria-label="Search tasks"/>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14}/></button>}</label><div className="filter-tabs">{(['all', 'working', 'review', 'queued'] as const).map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'working' ? 'Active' : f === 'review' ? 'Review' : 'Queued'}</button>)}</div></div>
              <div className="task-list">{visible.length ? visible.map(task => <button className={`task-row ${selectedId === task.id ? 'selected' : ''}`} key={task.id} onClick={() => setSelectedId(task.id)}><span className={`priority ${task.priority.toLowerCase()}`}/><div className="task-main"><div className="task-title"><span>#{task.id}</span><h3>{task.title}</h3></div><div className="task-meta"><span><GitBranch size={13}/>{task.repo}</span><span className={`agent-name ${task.agent.toLowerCase()}`}><i/>{task.agent}</span><span>{task.elapsed}</span></div>{task.status === 'working' && <div className="progress"><i style={{ width: `${task.progress}%` }}/></div>}</div><div className="task-right"><span className={`status ${task.status}`}>{task.status === 'working' && <span className="tiny-spinner"/>}{task.status === 'review' && <GitPullRequest size={13}/>} {task.status === 'done' && <Check size={13}/>} {statusLabel[task.status]}</span><ArrowUpRight size={15}/></div></button>) : <div className="empty"><Search size={26}/><h3>No matching tasks</h3><p>Try another search or filter.</p><button className="btn secondary" onClick={() => { setFilter('all'); setQuery('') }}>Clear filters</button></div>}</div>
            </section>
            <aside className="activity-panel"><div className="panel-head"><div><h2>Live activity</h2><span className={running ? 'live-dot' : 'live-dot paused'}/></div><button className="text-btn" onClick={() => setView('activity')}>View all</button></div><div className="activity-feed">{events.slice(0, 6).map(event => <div className="event" key={event.id}><span className="event-avatar" style={{ color: avatarColor[event.agent] }}>{event.agent === 'System' ? <Command size={14}/> : event.agent[0]}</span><div><p><b>{event.agent}</b> {event.text}</p><span>{event.time} ago</span></div></div>)}</div><div className="terminal"><div><Terminal size={13}/><span>SWARM LOG</span><i/></div><code><span>22:41:08</span> scout running tests<br/><span>22:41:12</span> forge build passed<br/><span>22:41:16</span> patch PR #476 ready</code></div></aside>
          </div>
          {selected && <section className="detail-strip"><div className="detail-id"><GitPullRequest size={18}/><span>#{selected.id}</span></div><div className="detail-copy"><h3>{selected.title}</h3><p>{selected.description}</p></div><div className="detail-actions">{['working', 'queued'].includes(selected.status) && <button className="btn secondary" onClick={() => toggleTask(selected.id)}>{selected.status === 'working' ? <Pause size={15}/> : <Play size={15}/>} {selected.status === 'working' ? 'Pause' : 'Start'}</button>}{selected.status !== 'done' && <button className="btn primary small" onClick={() => completeTask(selected.id)}><Check size={15}/>Complete</button>}</div></section>}
        </>}
        {view === 'agents' && <><section className="page-heading"><div><div className="eyebrow">AGENT FLEET</div><h1>Your engineering swarm.</h1><p>Specialized agents working as one coordinated team.</p></div><span className="fleet-status"><span className={running ? 'live-dot' : 'live-dot paused'}/>{running ? 'Fleet operational' : 'Fleet paused'}</span></section><section className="agents-grid">{agentMeta.map(agent => { const current = tasks.find(t => t.agent === agent.name && t.status === 'working'); return <article className="agent-card" key={agent.name}><div className="agent-card-top"><span className="large-agent" style={{ color: agent.color }}><Bot size={25}/></span><span className={`agent-state ${current && running ? 'online' : ''}`}>{current && running ? 'WORKING' : 'AVAILABLE'}</span></div><h2>{agent.name}</h2><p>{agent.role}</p><div className="agent-model"><Sparkles size={14}/>{agent.model}</div><div className="load-label"><span>Current capacity</span><b>{running ? agent.load : 0}%</b></div><div className="progress large"><i style={{ width: `${running ? agent.load : 0}%`, background: agent.color }}/></div><div className="current-work"><span>CURRENT ASSIGNMENT</span><p>{current && running ? `#${current.id} ${current.title}` : 'Ready for a new task'}</p></div><button className="btn secondary full" onClick={() => { setQuery(agent.name); setView('dashboard') }}>View assigned tasks<ArrowUpRight size={15}/></button></article>})}</section></>}
        {view === 'activity' && <><section className="page-heading"><div><div className="eyebrow">EVENT STREAM</div><h1>Every move, accounted for.</h1><p>A chronological record of agent and workspace activity.</p></div><button className="btn secondary" onClick={() => { setEvents(initialEvents); setToast('Activity feed refreshed') }}><Activity size={16}/>Refresh feed</button></section><section className="activity-full"><div className="panel-head"><div><h2>Workspace activity</h2><span>{events.length} events</span></div></div>{events.map(event => <div className="event full-event" key={event.id}><span className="event-avatar" style={{ color: avatarColor[event.agent] }}>{event.agent === 'System' ? <Command size={14}/> : event.agent[0]}</span><div><p><b>{event.agent}</b> {event.text}</p><span>{event.time} ago · acme workspace</span></div><Circle size={8} className={event.kind}/></div>)}</section></>}
      </div>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false) }}><form className="modal" onSubmit={addTask} role="dialog" aria-modal="true" aria-labelledby="new-task-title"><div className="modal-head"><div><span className="eyebrow">NEW ASSIGNMENT</span><h2 id="new-task-title">Give the swarm a task.</h2></div><button type="button" className="icon-btn" onClick={() => setModal(false)} aria-label="Close dialog"><X size={20}/></button></div><p className="modal-intro">Describe the outcome. An available agent will triage and pick up the work.</p><label>Task title<input autoFocus required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Fix pagination on repository list"/></label><label>Repository<select value={newRepo} onChange={e => setNewRepo(e.target.value)}><option>acme/platform</option><option>acme/dashboard</option><option>acme/docs</option></select></label><label>Priority<select value={newPriority} onChange={e => setNewPriority(e.target.value as Task['priority'])}><option>High</option><option>Medium</option><option>Low</option></select></label><div className="modal-note"><Bot size={17}/><span>Scribe will triage this task first. You can reassign it after the initial analysis.</span></div><div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn primary" type="submit"><Plus size={16}/>Add to queue</button></div></form></div>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{toast}</div>}
  </div>
}
