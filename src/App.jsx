import React, { useEffect, useMemo, useRef, useState } from 'react'

const NAV_ITEMS = [
  { id: 'home', icon: '⌂', label: 'Home' },
  { id: 'projects', icon: '▣', label: 'Projects' },
  { id: 'files', icon: '▤', label: 'Files' },
  { id: 'build', icon: '⚙', label: 'Build' },
  { id: 'chat', icon: '✦', label: 'AI Chat' },
  { id: 'flow', icon: '◇', label: 'Image Flow' },
  { id: 'drive', icon: '☁', label: 'Google Drive' },
  { id: 'settings', icon: '⚙', label: 'Settings' }
]

const INITIAL_PROJECTS = [
  {
    id: 'foundation',
    name: 'OU The Builder Foundation',
    type: 'WBA',
    status: 'Active',
    updated: new Date().toISOString()
  }
]

function App() {
  const [activePage, setActivePage] = useState('home')
  const [mobileMenu, setMobileMenu] = useState(false)

  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('ou_builder_projects')
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS
    } catch {
      return INITIAL_PROJECTS
    }
  })

  const [currentProject, setCurrentProject] = useState(() => {
    try {
      return localStorage.getItem('ou_builder_current') ||
        'OU The Builder Foundation'
    } catch {
      return 'OU The Builder Foundation'
    }
  })

  const [files, setFiles] = useState([])

  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Welcome to OU The Builder. I am ready to help you create and manage your project.'
    }
  ])

  const [chatInput, setChatInput] = useState('')
  const [buildStatus, setBuildStatus] = useState('Ready')

  const [buildLog, setBuildLog] = useState([
    'BUILD CONSOLE',
    'Ready for a build request.'
  ])

  const fileInput = useRef(null)

  useEffect(() => {
    localStorage.setItem(
      'ou_builder_projects',
      JSON.stringify(projects)
    )
  }, [projects])

  useEffect(() => {
    localStorage.setItem(
      'ou_builder_current',
      currentProject
    )
  }, [currentProject])

  const activeLabel = useMemo(() => {
    return NAV_ITEMS.find(item => item.id === activePage)?.label ||
      'Home'
  }, [activePage])

  function navigate(page) {
    setActivePage(page)
    setMobileMenu(false)
  }

  function createProject() {
    const name = window.prompt(
      'Enter the new project name:',
      'My New Project'
    )

    if (!name || !name.trim()) return

    const project = {
      id: Date.now().toString(),
      name: name.trim(),
      type: 'Project',
      status: 'Created',
      updated: new Date().toISOString()
    }

    setProjects(previous => [...previous, project])
    setCurrentProject(project.name)
    setActivePage('projects')
  }

  function removeProject(id) {
    const project = projects.find(item => item.id === id)

    if (!project) return

    if (!window.confirm(`Delete "${project.name}" from this browser?`)) {
      return
    }

    const remaining = projects.filter(item => item.id !== id)

    setProjects(
      remaining.length ? remaining : INITIAL_PROJECTS
    )
  }

  function chooseProject(project) {
    setCurrentProject(project.name)
    setActivePage('home')
  }

  function openFilePicker() {
    fileInput.current?.click()
  }

  function handleFiles(event) {
    const selected = Array.from(event.target.files || [])

    const prepared = selected.map(file => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type || 'Unknown'
    }))

    setFiles(previous => [...previous, ...prepared])
    event.target.value = ''
  }

  function clearFiles() {
    setFiles([])
  }

  function startBuild() {
    setBuildStatus('Building...')

    const steps = [
      'BUILD CONSOLE',
      'Project detected',
      'Project configuration checked',
      'Resources checked',
      'Build environment prepared',
      '→ Running build process',
      '→ Compiling project',
      '→ Packaging application',
      '→ Verifying output'
    ]

    setBuildLog([])

    steps.forEach((step, index) => {
      setTimeout(() => {
        setBuildLog(previous => [...previous, step])

        if (index === steps.length - 1) {
          setTimeout(() => {
            setBuildLog(previous => [
              ...previous,
              'BUILD FOUNDATION READY',
              'Remote APK compilation will be connected in the next build-system stage.'
            ])

            setBuildStatus('Ready')
          }, 350)
        }
      }, index * 400)
    })
  }

  function sendChat() {
    const text = chatInput.trim()

    if (!text) return

    setChatMessages(previous => [
      ...previous,
      {
        role: 'user',
        text
      }
    ])

    setChatInput('')

    setTimeout(() => {
      let response =
        'I received your request. The AI Builder connection will be integrated into this interface in the AI backend stage.'

      const lower = text.toLowerCase()

      if (
        lower.includes('build') ||
        lower.includes('compile')
      ) {
        response =
          'I can prepare a build request. The real remote APK compiler will be connected during the Build System stage.'
      } else if (
        lower.includes('project') &&
        lower.includes('create')
      ) {
        response =
          'Use New Project from the Projects section to create a project in the current WBA foundation.'
      } else if (
        lower.includes('flow') ||
        lower.includes('screen')
      ) {
        response =
          'The Image Flow section is ready for the visual application-flow system.'
      }

      setChatMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text: response
        }
      ])
    }, 450)
  }

  function renderPage() {
    switch (activePage) {

      case 'projects':
        return (
          <ProjectsPage
            projects={projects}
            currentProject={currentProject}
            createProject={createProject}
            chooseProject={chooseProject}
            removeProject={removeProject}
          />
        )

      case 'files':
        return (
          <FilesPage
            files={files}
            openFilePicker={openFilePicker}
            clearFiles={clearFiles}
          />
        )

      case 'build':
        return (
          <BuildPage
            status={buildStatus}
            log={buildLog}
            startBuild={startBuild}
          />
        )

      case 'chat':
        return (
          <ChatPage
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            sendChat={sendChat}
          />
        )

      case 'flow':
        return <FlowPage />

      case 'drive':
        return <DrivePage />

      case 'settings':
        return <SettingsPage />

      default:
        return (
          <HomePage
            currentProject={currentProject}
            projects={projects}
            files={files}
            navigate={navigate}
            createProject={createProject}
            startBuild={startBuild}
          />
        )
    }
  }

  return (
    <div className="app-shell">

      <div
        className={`mobile-overlay ${mobileMenu ? 'show' : ''}`}
        onClick={() => setMobileMenu(false)}
      />

      <aside
        className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}
      >
        <div className="brand">
          <div className="brand-mark">OU</div>

          <div>
            <div className="brand-title">
              OU The Builder
            </div>

            <div className="brand-subtitle">
              Web-Based Application
            </div>
          </div>
        </div>

        <div className="online-badge">
          <span className="dot green" />
          Online
        </div>

        <nav className="navigation">

          <div className="nav-title">
            WORKSPACE
          </div>

          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${
                activePage === item.id ? 'active' : ''
              }`}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>
            </button>
          ))}

        </nav>

        <div className="sidebar-bottom">
          <div className="version">
            v0.1.0
          </div>

          <div className="stage">
            Foundation Stage
          </div>
        </div>
      </aside>

      <main className="main-content">

        <header className="topbar">

          <button
            className="menu-button"
            onClick={() => setMobileMenu(true)}
          >
            ☰
          </button>

          <div className="topbar-title">
            <span>{activeLabel}</span>
          </div>

          <div className="topbar-project">
            <span>Current Project</span>
            <strong>{currentProject}</strong>
          </div>

        </header>

        <section className="page-container">
          {renderPage()}
        </section>

        <footer className="footer">
          <span>OU The Builder</span>
          <span>v0.1.0</span>
          <span>Foundation Stage</span>
        </footer>

      </main>

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={handleFiles}
      />

    </div>
  )
}

function HomePage({
  currentProject,
  projects,
  files,
  navigate,
  createProject,
  startBuild
}) {
  return (
    <>
      <section className="hero">

        <div>
          <div className="eyebrow">
            WEB-BASED APPLICATION
          </div>

          <h1>
            Welcome to <span>OU The Builder</span>
          </h1>

          <p>
            Build, manage, visualize and compile your projects
            from one workspace.
          </p>
        </div>

        <div className="hero-orb">
          <div>OU</div>
        </div>

      </section>

      <section className="status-row">

        <div className="status-chip">
          <span className="dot green" />
          WBA Online
        </div>

        <div className="status-chip">
          <span className="dot blue" />
          GitHub Actions Ready
        </div>

        <div className="status-chip">
          <span className="dot purple" />
          Node.js 24
        </div>

      </section>

      <div className="dashboard-grid">

        <FeatureCard
          icon="✦"
          title="AI Builder"
          text="Use AI to control builder operations and manage projects."
          accent="purple"
          onClick={() => navigate('chat')}
        />

        <FeatureCard
          icon="▣"
          title="Projects"
          text={`${projects.length} project${
            projects.length === 1 ? '' : 's'
          } in this workspace.`}
          accent="blue"
          onClick={() => navigate('projects')}
        />

        <FeatureCard
          icon="⚙"
          title="Build"
          text="Prepare projects for remote compilation and APK generation."
          accent="orange"
          onClick={() => navigate('build')}
        />

        <FeatureCard
          icon="◇"
          title="Image Flow"
          text="Visualize screens, navigation and application connections."
          accent="teal"
          onClick={() => navigate('flow')}
        />

      </div>

      <div className="two-column">

        <section className="panel chat-preview">

          <PanelHeader
            title="AI Chat"
            subtitle="Builder control interface"
            action="Open Chat"
            onAction={() => navigate('chat')}
          />

          <div className="chat-preview-body">

            <div className="assistant-avatar">
              ✦
            </div>

            <div>
              <strong>AI Builder</strong>

              <p>
                What would you like to build today?
              </p>
            </div>

          </div>

          <div className="quick-chat">

            <button onClick={() => navigate('chat')}>
              Create a project
            </button>

            <button onClick={() => navigate('chat')}>
              Prepare a build
            </button>

            <button onClick={() => navigate('chat')}>
              Show application flow
            </button>

          </div>

        </section>

        <section className="panel">

          <PanelHeader
            title="System Status"
            subtitle="Workspace services"
          />

          <div className="status-list">

            <StatusRow
              name="Frontend"
              value="Online"
              good
            />

            <StatusRow
              name="GitHub Actions"
              value="Ready"
              good
            />

            <StatusRow
              name="Backend API"
              value="Foundation"
            />

            <StatusRow
              name="Google Drive"
              value="Not Connected"
            />

          </div>

        </section>

      </div>

      <div className="three-column">

        <section className="panel">

          <PanelHeader
            title="Current Project"
            subtitle="Active workspace"
          />

          <div className="current-project">

            <div className="project-icon">
              OU
            </div>

            <div>
              <strong>{currentProject}</strong>
              <span>Active project</span>
            </div>

          </div>

          <button
            className="secondary-button full"
            onClick={() => navigate('projects')}
          >
            Open Project
          </button>

        </section>

        <section className="panel">

          <PanelHeader
            title="Quick Actions"
            subtitle="Common operations"
          />

          <div className="quick-actions">

            <button onClick={createProject}>
              ＋ New Project
            </button>

            <button onClick={() => navigate('files')}>
              ＋ Add Files
            </button>

            <button onClick={startBuild}>
              ▶ Prepare Build
            </button>

          </div>

        </section>

        <section className="panel">

          <PanelHeader
            title="Workspace"
            subtitle="Current activity"
          />

          <div className="workspace-stat">
            <strong>{files.length}</strong>
            <span>Selected files</span>
          </div>

          <div className="workspace-stat">
            <strong>{projects.length}</strong>
            <span>Projects</span>
          </div>

        </section>

      </div>
    </>
  )
}

function ProjectsPage({
  projects,
  currentProject,
  createProject,
  chooseProject,
  removeProject
}) {
  return (
    <PageHeader
      eyebrow="PROJECT MANAGEMENT"
      title="Projects"
      description="Create, manage and select your builder projects."
      action="＋ New Project"
      onAction={createProject}
    >

      <div className="project-grid">

        {projects.map(project => (
          <article
            className="project-card"
            key={project.id}
          >

            <div className="project-card-top">

              <div className="project-icon">
                OU
              </div>

              <span className="project-status">
                {project.status}
              </span>

            </div>

            <h3>{project.name}</h3>

            <p>
              Type: {project.type}
            </p>

            <div className="project-card-actions">

              <button
                className="primary-button"
                onClick={() => chooseProject(project)}
              >
                {currentProject === project.name
                  ? 'Current'
                  : 'Open'}
              </button>

              {project.id !== 'foundation' && (
                <button
                  className="danger-button"
                  onClick={() =>
                    removeProject(project.id)
                  }
                >
                  Delete
                </button>
              )}

            </div>

          </article>
        ))}

      </div>

    </PageHeader>
  )
}

function FilesPage({
  files,
  openFilePicker,
  clearFiles
}) {
  return (
    <PageHeader
      eyebrow="PROJECT FILES"
      title="Files"
      description="Add project resources and inspect files selected for the workspace."
      action="＋ Add Files"
      onAction={openFilePicker}
    >

      <section className="panel">

        <PanelHeader
          title="Project Resources"
          subtitle={`${files.length} file${
            files.length === 1 ? '' : 's'
          } selected`}
          action={files.length ? 'Clear' : undefined}
          onAction={clearFiles}
        />

        {files.length === 0 ? (
          <EmptyState
            icon="▤"
            title="No files selected"
            text="Add ZIP files, source files, images or other project resources from your device."
            action="Select Files"
            onAction={openFilePicker}
          />
        ) : (
          <div className="file-list">

            {files.map(file => (
              <div
                className="file-row"
                key={file.id}
              >

                <div className="file-icon">
                  FILE
                </div>

                <div className="file-info">

                  <strong>{file.name}</strong>

                  <span>
                    {file.type} · {formatBytes(file.size)}
                  </span>

                </div>

              </div>
            ))}

          </div>
        )}

      </section>

    </PageHeader>
  )
}

function BuildPage({
  status,
  log,
  startBuild
}) {
  return (
    <PageHeader
      eyebrow="BUILD SYSTEM"
      title="Build"
      description="Prepare your project for remote compilation."
      action="▶ Run Build"
      onAction={startBuild}
    >

      <div className="build-layout">

        <section className="panel">

          <PanelHeader
            title="Build Configuration"
            subtitle="Foundation configuration"
          />

          <div className="config-grid">

            <ConfigItem
              label="Target"
              value="Android APK"
            />

            <ConfigItem
              label="Build Type"
              value="Debug"
            />

            <ConfigItem
              label="Environment"
              value="Remote"
            />

            <ConfigItem
              label="Status"
              value={status}
            />

          </div>

          <button
            className="primary-button large"
            onClick={startBuild}
          >
            ▶ Run Build
          </button>

        </section>

        <section className="panel build-console">

          <PanelHeader
            title="Build Console"
            subtitle="Process output"
          />

          <div className="console">

            {log.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className={
                  line.includes('SUCCESSFUL') ||
                  line.includes('READY')
                    ? 'console-success'
                    : ''
                }
              >
                {line}
              </div>
            ))}

          </div>

        </section>

      </div>

    </PageHeader>
  )
}

function ChatPage({
  messages,
  input,
  setInput,
  sendChat
}) {
  return (
    <PageHeader
      eyebrow="AI CONTROL"
      title="AI Chat"
      description="The central conversational control interface for OU The Builder."
    >

      <section className="panel full-chat">

        <div className="chat-messages">

          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message ${
                message.role === 'user'
                  ? 'user-message'
                  : 'assistant-message'
              }`}
            >

              <div className="message-avatar">
                {message.role === 'user'
                  ? 'U'
                  : '✦'}
              </div>

              <div>

                <strong>
                  {message.role === 'user'
                    ? 'You'
                    : 'AI Builder'}
                </strong>

                <p>{message.text}</p>

              </div>

            </div>
          ))}

        </div>

        <div className="chat-input-row">

          <input
            value={input}
            onChange={event =>
              setInput(event.target.value)
            }
            onKeyDown={event => {
              if (event.key === 'Enter') {
                sendChat()
              }
            }}
            placeholder="Tell OU The Builder what you want to do..."
          />

          <button
            className="primary-button"
            onClick={sendChat}
          >
            Send
          </button>

        </div>

        <div className="chat-suggestions">

          <button
            onClick={() =>
              setInput('Create a new project')
            }
          >
            Create project
          </button>

          <button
            onClick={() =>
              setInput('Prepare this project for build')
            }
          >
            Prepare build
          </button>

          <button
            onClick={() =>
              setInput('Show the application flow')
            }
          >
            Show flow
          </button>

        </div>

      </section>

    </PageHeader>
  )
}

function FlowPage() {
  return (
    <PageHeader
      eyebrow="VISUAL BUILDER"
      title="Image Flow"
      description="Visualize application screens and navigation connections."
    >

      <section className="panel flow-panel">

        <div className="flow-canvas">

          <FlowNode
            title="Home"
            subtitle="Start screen"
            position="node-one"
          />

          <div className="flow-line line-one" />

          <FlowNode
            title="Projects"
            subtitle="Project manager"
            position="node-two"
          />

          <div className="flow-line line-two" />

          <FlowNode
            title="Build"
            subtitle="Build configuration"
            position="node-three"
          />

          <div className="flow-line line-three" />

          <FlowNode
            title="APK"
            subtitle="Build output"
            position="node-four"
          />

        </div>

        <div className="flow-note">
          Visual code-to-view mapping will be connected to the
          project parser in the Image Flow stage.
        </div>

      </section>

    </PageHeader>
  )
}

function DrivePage() {
  return (
    <PageHeader
      eyebrow="STORAGE"
      title="Google Drive"
      description="Connect cloud storage for project resources and archives."
    >

      <section className="panel centered-panel">

        <div className="large-icon">
          ☁
        </div>

        <h2>Google Drive</h2>

        <p>
          Google Drive integration is planned as an optional
          storage provider. Projects will remain portable and
          will not be locked to one storage service.
        </p>

        <button
          className="secondary-button"
          disabled
        >
          Connect Google Drive
        </button>

        <span className="coming-soon">
          Storage integration — upcoming stage
        </span>

      </section>

    </PageHeader>
  )
}

function SettingsPage() {
  return (
    <PageHeader
      eyebrow="APPLICATION"
      title="Settings"
      description="Configure OU The Builder services and future integrations."
    >

      <div className="settings-list">

        <SettingItem
          title="AI Agent"
          text="Choose or connect an AI agent for builder operations."
          value="Foundation"
        />

        <SettingItem
          title="Storage"
          text="Select the storage provider used by projects."
          value="Local Foundation"
        />

        <SettingItem
          title="Build Service"
          text="Remote build service configuration."
          value="GitHub Actions"
        />

        <SettingItem
          title="Application"
          text="OU The Builder Web-Based Application."
          value="v0.1.0"
        />

      </div>

    </PageHeader>
  )
}

function FeatureCard({
  icon,
  title,
  text,
  accent,
  onClick
}) {
  return (
    <button
      className={`feature-card ${accent}`}
      onClick={onClick}
    >

      <div className="feature-icon">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>

      <span className="feature-arrow">
        →
      </span>

    </button>
  )
}

function PanelHeader({
  title,
  subtitle,
  action,
  onAction
}) {
  return (
    <div className="panel-header">

      <div>
        <h2>{title}</h2>

        {subtitle && (
          <span>{subtitle}</span>
        )}
      </div>

      {action && (
        <button
          className="text-button"
          onClick={onAction}
        >
          {action}
        </button>
      )}

    </div>
  )
}

function StatusRow({
  name,
  value,
  good
}) {
  return (
    <div className="status-row-item">

      <span>{name}</span>

      <strong>
        {good && (
          <span className="dot green" />
        )}

        {value}
      </strong>

    </div>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
  children
}) {
  return (
    <>
      <div className="page-heading">

        <div>

          <div className="eyebrow">
            {eyebrow}
          </div>

          <h1>{title}</h1>

          <p>{description}</p>

        </div>

        {action && (
          <button
            className="primary-button"
            onClick={onAction}
          >
            {action}
          </button>
        )}

      </div>

      {children}
    </>
  )
}

function EmptyState({
  icon,
  title,
  text,
  action,
  onAction
}) {
  return (
    <div className="empty-state">

      <div className="empty-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

      {action && (
        <button
          className="secondary-button"
          onClick={onAction}
        >
          {action}
        </button>
      )}

    </div>
  )
}

function ConfigItem({
  label,
  value
}) {
  return (
    <div className="config-item">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>
  )
}

function FlowNode({
  title,
  subtitle,
  position
}) {
  return (
    <div className={`flow-node ${position}`}>

      <div className="flow-node-icon">
        ▣
      </div>

      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

    </div>
  )
}

function SettingItem({
  title,
  text,
  value
}) {
  return (
    <div className="setting-item">

      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>

      <span>{value}</span>

    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'

  const units = [
    'B',
    'KB',
    'MB',
    'GB'
  ]

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  )

  return `${(
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`
}

export default App
