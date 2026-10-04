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


const WORKSPACE_DB_NAME = 'ou-the-builder-workspace'
const WORKSPACE_DB_VERSION = 1
const WORKSPACE_STORE = 'fileBlobs'

const BUILD_BRIDGE_API = 'https://thebuilder.floot.app'

function openWorkspaceDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = window.indexedDB.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open workspace storage.'))
  })
}

async function putWorkspaceFile(id, blob) {
  const db = await openWorkspaceDB()
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readwrite')
    transaction.objectStore(WORKSPACE_STORE).put({ id, blob })
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error || new Error('Could not save project file.'))
  })
  db.close()
}

async function getWorkspaceFile(id) {
  const db = await openWorkspaceDB()
  const record = await new Promise((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readonly')
    const request = transaction.objectStore(WORKSPACE_STORE).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Could not read project file.'))
  })
  db.close()
  return record?.blob || null
}

async function deleteWorkspaceFile(id) {
  try {
    const db = await openWorkspaceDB()
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite')
      transaction.objectStore(WORKSPACE_STORE).delete(id)
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error || new Error('Could not delete project file.'))
    })
    db.close()
  } catch {}
}

async function clearWorkspaceFiles() {
  try {
    const db = await openWorkspaceDB()
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite')
      transaction.objectStore(WORKSPACE_STORE).clear()
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error || new Error('Could not clear project files.'))
    })
    db.close()
  } catch {}
}

function crc32(bytes) {
  let crc = 0xffffffff

  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(value) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff
  ])
}

function writeUint32(value) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ])
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0

  parts.forEach(part => {
    output.set(part, offset)
    offset += part.length
  })

  return output
}

async function createZipFromEntries(entries) {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(await entry.data.arrayBuffer())
    const name = encoder.encode(entry.name.replace(/^[/\\]+/, ''))
    const crc = crc32(data)

    const localHeader = concatUint8Arrays([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      writeUint16(20), writeUint16(0x0800), writeUint16(0),
      writeUint16(0), writeUint16(0), writeUint32(crc),
      writeUint32(data.length), writeUint32(data.length),
      writeUint16(name.length), writeUint16(0), name
    ])
    localParts.push(localHeader, data)

    const centralHeader = concatUint8Arrays([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      writeUint16(20), writeUint16(20), writeUint16(0x0800),
      writeUint16(0), writeUint16(0), writeUint16(0), writeUint32(crc),
      writeUint32(data.length), writeUint32(data.length),
      writeUint16(name.length), writeUint16(0), writeUint16(0),
      writeUint16(0), writeUint16(0), writeUint32(0), writeUint32(offset), name
    ])
    centralParts.push(centralHeader)
    offset += localHeader.length + data.length
  }

  const centralDirectory = concatUint8Arrays(centralParts)
  const localDirectory = concatUint8Arrays(localParts)
  const endOfCentralDirectory = concatUint8Arrays([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    writeUint16(0), writeUint16(0), writeUint16(entries.length),
    writeUint16(entries.length), writeUint32(centralDirectory.length),
    writeUint32(localDirectory.length), writeUint16(0)
  ])

  return new Blob([localDirectory, centralDirectory, endOfCentralDirectory], { type: 'application/zip' })
}

async function createProjectZip(projectFiles) {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of projectFiles) {
    const blob = await getWorkspaceFile(file.id)

    if (!blob) {
      throw new Error(`Missing stored content for: ${file.path || file.name}`)
    }

    const data = new Uint8Array(await blob.arrayBuffer())
    const name = encoder.encode((file.path || file.name).replace(/^\/+/, ''))
    const crc = crc32(data)

    const localHeader = concatUint8Arrays([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      writeUint16(20),
      writeUint16(0x0800),
      writeUint16(0),
      writeUint16(0),
      writeUint16(0),
      writeUint32(crc),
      writeUint32(data.length),
      writeUint32(data.length),
      writeUint16(name.length),
      writeUint16(0),
      name
    ])

    localParts.push(localHeader, data)

    const centralHeader = concatUint8Arrays([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      writeUint16(20),
      writeUint16(20),
      writeUint16(0x0800),
      writeUint16(0),
      writeUint16(0),
      writeUint16(0),
      writeUint32(crc),
      writeUint32(data.length),
      writeUint32(data.length),
      writeUint16(name.length),
      writeUint16(0),
      writeUint16(0),
      writeUint16(0),
      writeUint16(0),
      writeUint32(0),
      writeUint32(offset),
      name
    ])

    centralParts.push(centralHeader)
    offset += localHeader.length + data.length
  }

  const centralDirectory = concatUint8Arrays(centralParts)
  const localDirectory = concatUint8Arrays(localParts)
  const endOfCentralDirectory = concatUint8Arrays([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    writeUint16(0),
    writeUint16(0),
    writeUint16(projectFiles.length),
    writeUint16(projectFiles.length),
    writeUint32(centralDirectory.length),
    writeUint32(localDirectory.length),
    writeUint16(0)
  ])

  return new Blob([localDirectory, centralDirectory, endOfCentralDirectory], {
    type: 'application/zip'
  })
}

const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'openid',
  'email',
  'profile'
].join(' ')

function App() {
  const [activePage, setActivePage] = useState('home')

  useEffect(() => {
    window.history.replaceState({ ouBuilderPage: 'home' }, '', window.location.href)

    const handlePopState = (event) => {
      const page = event.state?.ouBuilderPage
      if (page && NAV_ITEMS.some(item => item.id === page)) {
        setActivePage(page)
        setMobileMenu(false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
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

  const [files, setFiles] = useState(() => {
    try {
      const saved = localStorage.getItem('ou_builder_files')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [pendingFolder, setPendingFolder] = useState(null)
  const [storageNotice, setStorageNotice] = useState('')

  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Welcome to OU The Builder. I am ready to help you create and manage your project.'
    }
  ])

  const [chatInput, setChatInput] = useState('')
  const [buildStatus, setBuildStatus] = useState('Ready')
  const [buildTarget, setBuildTarget] = useState('Android APK')
  const [buildType, setBuildType] = useState('Debug')

  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('ou_google_client_id') || '')
  const [googleConnected, setGoogleConnected] = useState(() => localStorage.getItem('ou_google_connected') === 'true')
  const [googleEmail, setGoogleEmail] = useState(() => localStorage.getItem('ou_google_email') || '')
  const [googleDriveMessage, setGoogleDriveMessage] = useState('')
  const [storageProvider, setStorageProvider] = useState(() => localStorage.getItem('ou_storage_provider') || 'mobidrive')
  const [mobiDriveMessage, setMobiDriveMessage] = useState('')
  const [mobiDriveLink, setMobiDriveLink] = useState(() => localStorage.getItem('ou_mobidrive_share_link') || 'https://mobidrive.com/sharelink/f/6XgpAG8WHBCb7UQsa0eMdT39ASA4xaaMEqJbLPAfRu6X')
  const [googleDriveFolderLink, setGoogleDriveFolderLink] = useState(() => localStorage.getItem('ou_google_drive_folder_link') || 'https://drive.google.com/drive/folders/1NaKfHr8kyacWvSHjkshm3yFX_KJrzx3U')
  const [buildHistory, setBuildHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ou_builder_build_history') || '[]') } catch { return [] }
  })
  const googleAccessToken = useRef(null)
  const googleTokenClient = useRef(null)
  const lastProjectZip = useRef(null)

  const [buildLog, setBuildLog] = useState([
    'BUILD CONSOLE',
    'Ready for a build request.'
  ])

  const fileInput = useRef(null)
  const folderInput = useRef(null)

  useEffect(() => {
    localStorage.setItem('ou_storage_provider', storageProvider)
  }, [storageProvider])

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

  useEffect(() => {
    localStorage.setItem(
      'ou_builder_files',
      JSON.stringify(files)
    )
  }, [files])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ou_builder_build_config') || '{}')
      if (saved.target) setBuildTarget(saved.target)
      if (saved.type) setBuildType(saved.type)
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem('ou_builder_build_history', JSON.stringify(buildHistory))
  }, [buildHistory])

  useEffect(() => {
    localStorage.setItem('ou_builder_build_config', JSON.stringify({ target: buildTarget, type: buildType }))
  }, [buildTarget, buildType])

  const activeLabel = useMemo(() => {
    return NAV_ITEMS.find(item => item.id === activePage)?.label ||
      'Home'
  }, [activePage])

  function navigate(page) {
    if (!NAV_ITEMS.some(item => item.id === page)) return
    if (page === activePage) {
      setMobileMenu(false)
      return
    }
    window.history.pushState({ ouBuilderPage: page }, '', window.location.href)
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
    navigate('projects')
  }

  function renameProject(project) {
    const name = window.prompt('Enter the new project name:', project.name)
    if (!name || !name.trim() || name.trim() === project.name) return
    const nextName = name.trim()
    setProjects(previous => previous.map(item => item.id === project.id
      ? { ...item, name: nextName, updated: new Date().toISOString() }
      : item
    ))
    if (currentProject === project.name) setCurrentProject(nextName)
  }

  function duplicateProject(project) {
    const name = window.prompt('Enter the duplicated project name:', `${project.name} Copy`)
    if (!name || !name.trim()) return
    const copy = { ...project, id: `project-${Date.now()}`, name: name.trim(), status: 'Duplicated', updated: new Date().toISOString() }
    setProjects(previous => [...previous, copy])
    setCurrentProject(copy.name)
  }

  async function exportWorkspace() {
    try {
      const entries = []
      const manifest = {
        format: 'OU The Builder Workspace Backup',
        version: '0.1.0',
        exportedAt: new Date().toISOString(),
        currentProject,
        projects,
        files,
        buildHistory,
        storage: { provider: storageProvider, mobiDriveLink, googleDriveFolderLink }
      }

      entries.push({
        name: 'workspace.json',
        data: new TextEncoder().encode(JSON.stringify(manifest, null, 2))
      })

      for (const file of files) {
        const blob = await getWorkspaceFile(file.id)
        if (!blob) continue
        const data = new Uint8Array(await blob.arrayBuffer())
        const safeProject = (file.project || currentProject).replace(/[^a-z0-9._-]+/gi, '_')
        const safePath = (file.path || file.name).replace(/^[/\\]+/, '').split('/').map(part => part.replace(/[^a-z0-9._-]+/gi, '_')).join('/')
        entries.push({
          name: `files/${safeProject}/${safePath}`,
          data
        })
      }

      const blob = await createZipFromEntries(entries)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ou-the-builder-workspace-backup.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setStorageNotice(`Workspace backup exported with ${files.length} project file(s).`)
    } catch (error) {
      setStorageNotice(`Workspace backup failed: ${error.message}`)
    }
  }

  function removeProject(id) {
    const project = projects.find(item => item.id === id)

    if (!project) return

    if (!window.confirm(`Delete "${project.name}" from this browser?`)) {
      return
    }

    const remaining = projects.filter(item => item.id !== id)
    const nextProjects = remaining.length ? remaining : INITIAL_PROJECTS

    setProjects(nextProjects)

    if (project.name === currentProject) {
      setCurrentProject(nextProjects[0].name)
    }
  }

  function chooseProject(project) {
    setCurrentProject(project.name)
    navigate('files')
  }

  function openFilePicker() {
    fileInput.current?.click()
  }

  function openFolderPicker() {
    folderInput.current?.click()
  }

  async function addFilesToWorkspace(selected, source = 'file') {
    const now = Date.now()
    const prepared = selected.map((file, index) => ({
      id: `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified || 0}-${now}-${index}`,
      name: file.name,
      path: file.webkitRelativePath || file.name,
      size: file.size,
      type: file.type || 'Unknown',
      source,
      project: currentProject,
      lastModified: file.lastModified || 0
    }))

    for (let index = 0; index < selected.length; index += 1) {
      await putWorkspaceFile(prepared[index].id, selected[index])
    }

    setFiles(previous => {
      const existing = new Set(previous.map(file => `${file.path}|${file.size}|${file.lastModified || 0}`))
      const additions = prepared.filter(file => !existing.has(`${file.path}|${file.size}|${file.lastModified || 0}`))
      return [...previous, ...additions]
    })

    return prepared
  }

  async function handleFiles(event) {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return

    try {
      const prepared = await addFilesToWorkspace(selected, 'file')
      setStorageNotice(`${prepared.length} file${prepared.length === 1 ? '' : 's'} added to the current workspace.`)
    } catch (error) {
      setStorageNotice(`Could not store project files: ${error.message}`)
    }

    event.target.value = ''
  }

  async function handleFolder(event) {
    const selected = Array.from(event.target.files || [])
    if (!selected.length) return

    const firstPath = selected[0].webkitRelativePath || selected[0].name
    const folderName = firstPath.split('/')[0] || 'Selected Folder'
    const now = Date.now()

    const prepared = selected.map((file, index) => ({
      id: `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified || 0}-${now}-${index}`,
      name: file.name,
      path: file.webkitRelativePath || file.name,
      size: file.size,
      type: file.type || 'Unknown',
      source: 'folder',
      project: currentProject,
      lastModified: file.lastModified || 0
    }))

    try {
      for (let index = 0; index < selected.length; index += 1) {
        await putWorkspaceFile(prepared[index].id, selected[index])
      }

      setPendingFolder({
        name: folderName,
        files: prepared
      })
      setStorageNotice(`Folder "${folderName}" is selected. Press Use this Folder to import it.`)
    } catch (error) {
      setStorageNotice(`Could not store folder files: ${error.message}`)
    }

    event.target.value = ''
  }

  function useSelectedFolder() {
    if (!pendingFolder) return

    setFiles(previous => {
      const existing = new Set(previous.map(file => `${file.path}|${file.size}|${file.lastModified || 0}`))
      const additions = pendingFolder.files.filter(file => !existing.has(`${file.path}|${file.size}|${file.lastModified || 0}`))
      return [...previous, ...additions]
    })

    const existing = projects.find(project => project.name === pendingFolder.name)

    if (!existing) {
      const project = {
        id: `folder-${Date.now()}`,
        name: pendingFolder.name,
        type: 'Imported Folder',
        status: 'Active',
        updated: new Date().toISOString()
      }

      setProjects(previous => [...previous, project])
      setCurrentProject(project.name)
    } else {
      setCurrentProject(existing.name)
    }

    setStorageNotice(`Folder "${pendingFolder.name}" is now the current project source.`)
    setPendingFolder(null)
    setActivePage('files')
  }

  async function removeFile(id) {
    await deleteWorkspaceFile(id)
    setFiles(previous => previous.filter(file => file.id !== id))
  }

  async function clearFiles() {
    if (!files.length) return
    if (!window.confirm('Remove all imported files from this browser workspace?')) return
    await clearWorkspaceFiles()
    setFiles([])
    setStorageNotice('Workspace files cleared.')
  }

  function getCurrentProjectFiles() {
    return files.filter(file => !file.project || file.project === currentProject)
  }

  function downloadBuildManifest() {
    const projectFiles = getCurrentProjectFiles()
    const manifest = {
      format: 'OU The Builder Project Build Manifest',
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      project: {
        name: currentProject,
        target: buildTarget,
        buildType
      },
      storage: {
        provider: storageProvider,
        mobiDriveShareLink: storageProvider === 'mobidrive' ? mobiDriveLink : '',
        googleDriveFolderLink: storageProvider === 'google' ? googleDriveFolderLink : ''
      },
      files: projectFiles.map(file => ({
        name: file.name,
        path: file.path || file.name,
        size: file.size,
        type: file.type,
        source: file.source || 'file',
        lastModified: file.lastModified || 0
      }))
    }

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentProject.replace(/[^a-z0-9-_]+/gi, '_')}-build-manifest.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStorageNotice(`Build manifest exported with ${projectFiles.length} project file(s).`)
  }

  function downloadBuildSourceZip() {
    if (!lastProjectZip.current) {
      setBuildLog(previous => [...previous, 'No packaged project ZIP is available. Run Build first.'])
      return
    }

    const url = URL.createObjectURL(lastProjectZip.current)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentProject.replace(/[^a-z0-9-_]+/gi, '_')}-source.zip`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setBuildLog(previous => [...previous, `Project source ZIP exported: ${formatBytes(lastProjectZip.current.size)}`])
  }

  function downloadBuildLog() {
    const blob = new Blob([buildLog.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentProject.replace(/[^a-z0-9-_]+/gi, '_')}-build-log.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function resetWorkspace() {
    if (!window.confirm('Reset the local OU The Builder workspace? This removes projects and imported files stored in this browser.')) return
    localStorage.removeItem('ou_builder_projects')
    localStorage.removeItem('ou_builder_current')
    localStorage.removeItem('ou_builder_files')
    await clearWorkspaceFiles()
    window.location.reload()
  }

  async function startBuild() {
    if (buildStatus === 'Building...') return

    navigate('build')
    setBuildStatus('Building...')

    const projectFiles = getCurrentProjectFiles()
    setBuildLog([
      'BUILD CONSOLE',
      `Project detected: ${currentProject}`,
      `Target selected: ${buildTarget}`,
      `Build type: ${buildType}`,
      projectFiles.length ? `Resources checked: ${projectFiles.length} project file(s)` : 'Resources checked: no project files'
    ])

    if (!projectFiles.length) {
      setBuildLog(previous => [...previous, 'BUILD STOPPED', 'No project source files are available.'])
      setBuildStatus('Ready')
      return
    }

    if (buildTarget !== 'Android APK') {
      setBuildLog(previous => [...previous, 'BUILD STOPPED', `Remote compilation is currently wired for Android APK. Target: ${buildTarget}`])
      setBuildStatus('Ready')
      return
    }

    try {
      setBuildLog(previous => [...previous, '→ Packaging project source'])
      lastProjectZip.current = await createProjectZip(projectFiles)
      setBuildLog(previous => [
        ...previous,
        `Project source packaged: ${formatBytes(lastProjectZip.current.size)} ZIP`,
        '→ Requesting secure build upload slot'
      ])

      const uploadResponse = await fetch(`${BUILD_BRIDGE_API}/_api/build-source-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: currentProject,
          fileName: `${currentProject.replace(/[^a-z0-9-_]+/gi, '_')}-source.zip`,
          contentType: 'application/zip',
          sizeBytes: lastProjectZip.current.size
        })
      })

      const uploadText = await uploadResponse.text()
      let uploadData
      try {
        uploadData = JSON.parse(uploadText)
      } catch {
        uploadData = null
      }
      if (!uploadResponse.ok || !uploadData?.presignedUrl) {
        throw new Error(uploadData?.error || `Build upload preparation failed (${uploadResponse.status})`)
      }

      setBuildLog(previous => [...previous, '→ Uploading source ZIP securely'])
      const putResponse = await fetch(uploadData.presignedUrl, {
        method: 'PUT',
        headers: uploadData.uploadHeaders || {},
        body: lastProjectZip.current
      })
      if (!putResponse.ok) {
        throw new Error(`Source ZIP upload failed (${putResponse.status})`)
      }

      setBuildLog(previous => [...previous, '→ Triggering GitHub Actions remote build'])
      const buildResponse = await fetch(`${BUILD_BRIDGE_API}/_api/trigger-android-build`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          projectName: currentProject,
          storageKey: uploadData.storageKey,
          buildType: buildType.toLowerCase(),
          gradleTask: ''
        })
      })

      const buildText = await buildResponse.text()
      let buildData
      try {
        buildData = JSON.parse(buildText)
      } catch {
        buildData = null
      }
      if (!buildResponse.ok || !buildData?.accepted) {
        throw new Error(buildData?.error || `GitHub build trigger failed (${buildResponse.status})`)
      }

      const completedAt = new Date().toISOString()
      setBuildLog(previous => [
        ...previous,
        `GitHub Actions build accepted: ${buildData.eventId}`,
        '→ Remote runner will inspect, compile, and verify the project',
        'BUILD REQUEST SENT'
      ])
      setBuildHistory(previous => [{
        id: `build-${Date.now()}`,
        project: currentProject,
        target: buildTarget,
        type: buildType,
        status: 'Queued',
        completedAt,
        fileCount: projectFiles.length,
        zipSize: lastProjectZip.current.size,
        eventId: buildData.eventId
      }, ...previous].slice(0, 20))
      setProjects(previous => previous.map(project => project.name === currentProject ? { ...project, status: 'Build Queued', updated: completedAt } : project))
      setBuildStatus('Queued')
    } catch (error) {
      setBuildLog(previous => [...previous, 'BUILD STOPPED', `Remote build handoff failed: ${error.message}`])
      setBuildStatus('Ready')
    }
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
          'Build request received. I am starting the current project build preparation now.'
        setTimeout(() => startBuild(), 100)
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

  function loadGoogleIdentityServices() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }

      const existing = document.querySelector('script[data-google-identity-services]')
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Google Identity Services could not be loaded.')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.googleIdentityServices = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Google Identity Services could not be loaded.'))
      document.head.appendChild(script)
    })
  }

  function selectStorageProvider(provider) {
    setStorageProvider(provider)
    if (provider === 'mobidrive') {
      setMobiDriveMessage('MobiDrive is the default storage location. The saved share link is ready for the storage layer; direct file API synchronization remains a separate integration step.')
    } else if (provider === 'google') {
      setMobiDriveMessage('')
    } else {
      setMobiDriveMessage('Browser Workspace is selected. Files remain in this browser until a cloud provider is connected.')
    }
  }

  function saveGoogleDriveFolderLink(link = googleDriveFolderLink) {
    const cleanLink = link.trim()
    if (cleanLink && !/^https?:\/\/drive\.google\.com\//i.test(cleanLink)) {
      setGoogleDriveMessage('Please enter a valid Google Drive folder link.')
      return false
    }
    setGoogleDriveFolderLink(cleanLink)
    if (cleanLink) localStorage.setItem('ou_google_drive_folder_link', cleanLink)
    else localStorage.removeItem('ou_google_drive_folder_link')
    setGoogleDriveMessage(cleanLink ? 'Google Drive folder link saved for this browser.' : 'Google Drive folder link cleared.')
    return true
  }

  function saveMobiDriveLink(link = mobiDriveLink) {
    const cleanLink = link.trim()
    if (cleanLink && !/^https?:\/\/mobidrive\.com\//i.test(cleanLink) && !/^https?:\/\/[^/]*mobidrive\.com\//i.test(cleanLink)) {
      setMobiDriveMessage('Please enter a valid MobiDrive link.')
      return false
    }
    setMobiDriveLink(cleanLink)
    if (cleanLink) {
      localStorage.setItem('ou_mobidrive_share_link', cleanLink)
      setMobiDriveMessage('MobiDrive share link saved for this browser.')
    } else {
      localStorage.removeItem('ou_mobidrive_share_link')
      setMobiDriveMessage('MobiDrive share link cleared.')
    }
    return true
  }

  function openMobiDrive() {
    const target = mobiDriveLink.trim() || 'https://www.mobidrive.com/'
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  async function connectGoogleDrive(clientId = googleClientId) {
    const cleanClientId = clientId.trim()

    if (!cleanClientId) {
      setGoogleDriveMessage('Enter your Google OAuth Web Client ID first.')
      return
    }

    setGoogleDriveMessage('Opening Google authorization...')
    setGoogleClientId(cleanClientId)
    localStorage.setItem('ou_google_client_id', cleanClientId)

    try {
      await loadGoogleIdentityServices()

      googleTokenClient.current = window.google.accounts.oauth2.initTokenClient({
        client_id: cleanClientId,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: async (response) => {
          if (response.error) {
            setGoogleDriveMessage(`Google authorization failed: ${response.error}`)
            return
          }

          googleAccessToken.current = response.access_token

          try {
            const identityResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${response.access_token}`
              }
            })

            if (!identityResponse.ok) {
              throw new Error('Google account information could not be read.')
            }

            const identity = await identityResponse.json()
            const email = identity.email || 'Google account connected'

            setGoogleEmail(email)
            setGoogleConnected(true)
            localStorage.setItem('ou_google_connected', 'true')
            localStorage.setItem('ou_google_email', email)
            setGoogleDriveMessage('Google authorization succeeded. Testing Google Drive access...')

            const driveResponse = await fetch(
              'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,mimeType,modifiedTime)',
              {
                headers: {
                  Authorization: `Bearer ${response.access_token}`
                }
              }
            )

            if (!driveResponse.ok) {
              const errorBody = await driveResponse.text()
              throw new Error(errorBody || 'Google Drive API access failed.')
            }

            const driveData = await driveResponse.json()
            setGoogleDriveMessage(`Google Drive connected. App data access is working (${driveData.files?.length || 0} app file(s) found).`)
          } catch (error) {
            setGoogleConnected(false)
            localStorage.removeItem('ou_google_connected')
            setGoogleDriveMessage(error.message || 'Google Drive access could not be verified.')
          }
        }
      })

      googleTokenClient.current.requestAccessToken({ prompt: 'consent' })
    } catch (error) {
      setGoogleDriveMessage(error.message || 'Google authorization could not start.')
    }
  }

  function disconnectGoogleDrive() {
    if (googleAccessToken.current && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(googleAccessToken.current, () => {})
    }

    googleAccessToken.current = null
    googleTokenClient.current = null
    setGoogleConnected(false)
    setGoogleEmail('')
    setGoogleDriveMessage('Google Drive connection removed from this browser.')
    localStorage.removeItem('ou_google_connected')
    localStorage.removeItem('ou_google_email')
  }

  async function saveGoogleClientId() {
    const value = googleClientId.trim()
    if (!value) {
      setGoogleDriveMessage('Enter a Google OAuth Web Client ID.')
      return
    }

    localStorage.setItem('ou_google_client_id', value)
    setGoogleClientId(value)
    setGoogleDriveMessage('Google Client ID saved. You can now connect your Google Drive account.')
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
            renameProject={renameProject}
            duplicateProject={duplicateProject}
            exportWorkspace={exportWorkspace}
          />
        )

      case 'files':
        return (
          <FilesPage
            files={getCurrentProjectFiles()}
            openFilePicker={openFilePicker}
            openFolderPicker={openFolderPicker}
            pendingFolder={pendingFolder}
            useSelectedFolder={useSelectedFolder}
            removeFile={removeFile}
            clearFiles={clearFiles}
            notice={storageNotice}
          />
        )

      case 'build':
        return (
          <BuildPage
            status={buildStatus}
            log={buildLog}
            startBuild={startBuild}
            target={buildTarget}
            setTarget={setBuildTarget}
            buildType={buildType}
            setBuildType={setBuildType}
            downloadBuildSourceZip={downloadBuildSourceZip}
            downloadBuildLog={downloadBuildLog}
            downloadBuildManifest={downloadBuildManifest}
            buildHistory={buildHistory}
          />
        )

      case 'chat':
        return (
          <ChatPage
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            sendChat={sendChat}
            setMessages={setChatMessages}
          />
        )

      case 'flow':
        return <FlowPage />

      case 'drive':
        return (
          <DrivePage
            connected={googleConnected}
            email={googleEmail}
            message={googleDriveMessage}
            connectGoogleDrive={() => connectGoogleDrive()}
            disconnectGoogleDrive={disconnectGoogleDrive}
            storageProvider={storageProvider}
            selectStorageProvider={selectStorageProvider}
            mobiDriveMessage={mobiDriveMessage}
            mobiDriveLink={mobiDriveLink}
            setMobiDriveLink={setMobiDriveLink}
            saveMobiDriveLink={saveMobiDriveLink}
            openMobiDrive={openMobiDrive}
            googleDriveFolderLink={googleDriveFolderLink}
          />
        )

      case 'settings':
        return (
          <SettingsPage
            resetWorkspace={resetWorkspace}
            googleClientId={googleClientId}
            setGoogleClientId={setGoogleClientId}
            googleConnected={googleConnected}
            googleEmail={googleEmail}
            googleDriveMessage={googleDriveMessage}
            googleDriveFolderLink={googleDriveFolderLink}
            setGoogleDriveFolderLink={setGoogleDriveFolderLink}
            saveGoogleDriveFolderLink={saveGoogleDriveFolderLink}
            storageProvider={storageProvider}
            selectStorageProvider={selectStorageProvider}
            mobiDriveMessage={mobiDriveMessage}
            mobiDriveLink={mobiDriveLink}
            setMobiDriveLink={setMobiDriveLink}
            saveMobiDriveLink={saveMobiDriveLink}
            openMobiDrive={openMobiDrive}
            saveGoogleClientId={saveGoogleClientId}
            connectGoogleDrive={() => connectGoogleDrive()}
            disconnectGoogleDrive={disconnectGoogleDrive}
          />
        )

      default:
        return (
          <HomePage
  currentProject={currentProject}
  projects={projects}
  files={files}
  navigate={navigate}
  createProject={createProject}
  startBuild={startBuild}
  chatInput={chatInput}
  setChatInput={setChatInput}
  sendChat={sendChat}
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
        accept=".zip,.rar,.txt,.pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.mp4,.js,.jsx,.ts,.tsx,.json,.html,.css,.kt,.java,.xml"
        onChange={handleFiles}
      />

      <input
        ref={folderInput}
        type="file"
        webkitdirectory="true"
        directory=""
        multiple
        hidden
        onChange={handleFolder}
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
  startBuild,
  chatInput,
  setChatInput,
  sendChat
}) {
  return (
    <>
      {/* =========================
          WELCOME
         ========================= */}

      <section className="hero">

        <div className="hero-copy">

          <h1>
            Welcome to<br />
            <span>OU The Builder</span>
          </h1>

          <p>
            Your all-in-one platform to build, create
            and bring your app ideas to life with the
            power of AI.
          </p>

        </div>

        <div className="hero-orb">
          <div>OU</div>
        </div>

      </section>


      {/* =========================
          AI CHAT
         ========================= */}

      <section className="panel home-chat-panel">

        <div className="panel-header">

          <div>
            <h2>AI Chat</h2>

            <span>
              Ask, create, build, and get things done.
              The AI assistant is connected to all your
              builder features.
            </span>
          </div>

        </div>


        <div className="home-chat-input">

          <input
            value={chatInput}
            onChange={(event) =>
              setChatInput(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                sendChat()
              }
            }}
            placeholder="Type your message or command..."
          />

          <button
            className="chat-send-button"
            onClick={sendChat}
            aria-label="Send"
          >
            ➤
          </button>

        </div>


        <div className="agent-select-row">

          <button
            className="agent-select"
            type="button"
          >
            <span className="agent-symbol">
              ♧
            </span>

            <span>
              Free Agent (Built-in)
            </span>

            <span>
              ⌄
            </span>
          </button>


          <button
            className="agent-select"
            type="button"
          >
            <span className="agent-symbol">
              ♧
            </span>

            <span>
              Select Agent
            </span>

            <span>
              ⌄
            </span>
          </button>

        </div>

      </section>


      {/* =========================
          MAIN FEATURES
         ========================= */}

      <section className="panel main-features-panel">

        <div className="panel-header">

          <div>
            <h2>Main Features</h2>

            <span>
              Choose what you want to do
            </span>
          </div>

        </div>


        <div className="dashboard-grid">

          <FeatureCard
            icon="⚒"
            title="Build"
            text="Compile and build your app for Android, Web or Hybrid."
            accent="blue"
            onClick={() => navigate('build')}
          />


          <FeatureCard
            icon="□"
            title="Projects"
            text="Manage your projects and workspace."
            accent="green"
            onClick={() => navigate('projects')}
          />


          <FeatureCard
            icon="▧"
            title="Image Flow"
            text="Visualize your app screens and flow (Figma-like)."
            accent="purple"
            onClick={() => navigate('flow')}
          />


          <FeatureCard
            icon="AI"
            title="AI Chat"
            text="Chat with AI and use agents to help you build."
            accent="cyan"
            onClick={() => navigate('chat')}
          />


          <FeatureCard
            icon="▤"
            title="Files"
            text="Upload and manage your files (centralized for all features)."
            accent="yellow"
            onClick={() => navigate('files')}
          />


          <FeatureCard
            icon="◆"
            title="Google Drive"
            text="Access and sync your files with Google Drive."
            accent="drive"
            onClick={() => navigate('drive')}
          />


          <FeatureCard
            icon="☁"
            title="Mobidrive"
            text="Access and sync your files with MobiDrive."
            accent="pink"
            onClick={() => navigate('drive')}
          />


          <FeatureCard
            icon="⚙"
            title="Settings"
            text="Configure agents, cloud providers, and app preferences."
            accent="gray"
            onClick={() => navigate('settings')}
          />

        </div>

      </section>


      {/* =========================
          SYSTEM STATUS
         ========================= */}

      <section className="panel home-system-status">

        <div className="panel-header">

          <div>
            <h2>System Status</h2>
          </div>

        </div>


        <div className="system-status-grid">

          <div className="system-status-item">

            <span className="status-label">
              Current Project
            </span>

            <strong>
              <span className="dot green" />

              {currentProject || 'No project open'}
            </strong>

          </div>


          <div className="system-status-item">

            <span className="status-label">
              Cloud Provider
            </span>

            <strong>
              ☁ Google Drive
            </strong>

          </div>


          <div className="system-status-item">

            <span className="status-label">
              Agent
            </span>

            <strong>
              ♧ Free Agent
            </strong>

          </div>


          <div className="system-status-item">

            <span className="status-label">
              Status
            </span>

            <strong>
              <span className="dot green" />
              Ready
            </strong>

          </div>

        </div>

      </section>

    </>
  )
}

function ProjectsPage({
  projects,
  currentProject,
  createProject,
  chooseProject,
  removeProject,
  renameProject,
  duplicateProject,
  exportWorkspace
}) {
  return (
    <PageHeader
      eyebrow="PROJECT MANAGEMENT"
      title="Projects"
      description="Create, manage and select your builder projects."
      action="＋ New Project"
      onAction={createProject}
    >
      <div className="quick-actions" style={{ marginBottom: '1rem' }}>
        <button onClick={exportWorkspace}>↓ Export Workspace</button>
      </div>

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

              <button className="secondary-button" onClick={() => renameProject(project)}>Rename</button>
              <button className="secondary-button" onClick={() => duplicateProject(project)}>Duplicate</button>
              {project.id !== 'foundation' && (
                <button className="danger-button" onClick={() => removeProject(project.id)}>Delete</button>
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
  openFolderPicker,
  pendingFolder,
  useSelectedFolder,
  removeFile,
  clearFiles,
  notice
}) {
  return (
    <PageHeader
      eyebrow="PROJECT & STORAGE"
      title="Files"
      description="Add project resources, ZIP archives, or use an entire extracted folder as the current project source."
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

        <div className="quick-actions">
          <button onClick={openFilePicker}>
            ＋ Upload Files / ZIP
          </button>

          <button onClick={openFolderPicker}>
            📁 Browse Folder
          </button>

          {pendingFolder && (
            <button
              className="primary-button"
              onClick={useSelectedFolder}
            >
              📁 Use this Folder
            </button>
          )}
        </div>

        {notice && (
          <div className="flow-note">
            {notice}
          </div>
        )}

        {pendingFolder && (
          <div className="flow-note">
            <strong>{pendingFolder.name}</strong> selected — {pendingFolder.files.length} file{pendingFolder.files.length === 1 ? '' : 's'} found. Press <strong>Use this Folder</strong> to make the entire folder the current project source.
          </div>
        )}

        {files.length === 0 ? (
          <EmptyState
            icon="▤"
            title="No files selected"
            text="Upload individual files or a ZIP, or browse an extracted folder and use the entire folder without selecting each file separately."
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
                  {file.source === 'folder' ? 'DIR' : 'FILE'}
                </div>

                <div className="file-info">

                  <strong>{file.name}</strong>

                  <span>
                    {file.path || file.name} · {file.type} · {formatBytes(file.size)}
                  </span>

                </div>

                <button
                  className="text-button"
                  onClick={() => removeFile(file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  Remove
                </button>

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
  startBuild,
  target,
  setTarget,
  buildType,
  setBuildType,
  downloadBuildSourceZip,
  downloadBuildLog,
  downloadBuildManifest,
  buildHistory
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

            <label className="config-item">
              <span>Target</span>
              <select value={target} onChange={event => setTarget(event.target.value)}>
                <option>Android APK</option>
                <option>Web App</option>
              </select>
            </label>

            <label className="config-item">
              <span>Build Type</span>
              <select value={buildType} onChange={event => setBuildType(event.target.value)}>
                <option>Debug</option>
                <option>Release</option>
              </select>
            </label>

            <ConfigItem
              label="Environment"
              value="Remote"
            />

            <ConfigItem
              label="Status"
              value={status}
            />

          </div>

          <div className="quick-actions">
            <button
              className="primary-button large"
              onClick={startBuild}
              disabled={status === 'Building...'}
            >
              {status === 'Building...' ? '⏳ Building...' : '▶ Run Build'}
            </button>

            <button
              className="secondary-button"
              onClick={downloadBuildSourceZip}
              disabled={status === 'Building...' }
            >
              ↓ Export Source ZIP
            </button>

            <button
              className="secondary-button"
              onClick={downloadBuildLog}
              disabled={!log.length}
            >
              ↓ Save Build Log
            </button>

            <button
              className="secondary-button"
              onClick={downloadBuildManifest}
            >
              ↓ Export Build Manifest
            </button>
          </div>

        </section>

        <section className="panel">
          <PanelHeader title="Build History" subtitle="Recent prepared builds" />
          {buildHistory.length ? (
            <div className="status-list">
              {buildHistory.slice(0, 8).map(item => (
                <StatusRow
                  key={item.id}
                  name={`${item.project} · ${item.target}`}
                  value={`${item.status} · ${item.type}`}
                  good={item.status === 'Prepared'}
                />
              ))}
            </div>
          ) : (
            <p className="flow-note">No build history yet.</p>
          )}
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
  sendChat,
  setMessages
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

                <button
                  className="text-button"
                  onClick={() => navigator.clipboard?.writeText(message.text)}
                >
                  Copy
                </button>

              </div>

            </div>
          ))}

        </div>

        <div className="quick-actions">
          <button onClick={() => setMessages([{ role: 'assistant', text: 'New chat started. What would you like to build?' }])}>
            ＋ New Chat
          </button>
          <button onClick={() => navigator.clipboard?.writeText(messages.map(message => `${message.role === 'user' ? 'You' : 'AI Builder'}: ${message.text}`).join('\n\n'))}>
            Copy Conversation
          </button>
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

function DrivePage({
  connected,
  email,
  message,
  connectGoogleDrive,
  disconnectGoogleDrive,
  storageProvider,
  selectStorageProvider,
  mobiDriveMessage,
  mobiDriveLink,
  setMobiDriveLink,
  saveMobiDriveLink,
  openMobiDrive,
  googleDriveFolderLink
}) {
  return (
    <PageHeader
      eyebrow="STORAGE"
      title="Cloud Storage"
      description="Choose the cloud storage provider used by OU The Builder. Google Drive remains available, and MobiDrive is added as an option."
    >

      <section className="panel centered-panel">

        <div className="large-icon">
          ☁
        </div>

        <h2>Cloud Storage</h2>

        <div className="quick-actions">
          <button
            className={storageProvider === 'google' ? 'primary-button' : 'secondary-button'}
            onClick={() => selectStorageProvider('google')}
          >
            Google Drive
          </button>
          <button
            className={storageProvider === 'mobidrive' ? 'primary-button' : 'secondary-button'}
            onClick={() => selectStorageProvider('mobidrive')}
          >
            MobiDrive
          </button>
          <button
            className={storageProvider === 'local' ? 'primary-button' : 'secondary-button'}
            onClick={() => selectStorageProvider('local')}
          >
            Browser Workspace
          </button>
        </div>

        {storageProvider === 'mobidrive' ? (
          <>
            <p><strong>MobiDrive selected.</strong> Your existing MobiDrive account can be used as an external storage destination.</p>
            <div className="flow-note">
              The current foundation does not claim a direct MobiDrive API/OAuth connection. MobiDrive provides web access, but we have not found public developer API documentation for a direct browser integration.
            </div>
            <label className="field-label">
              MobiDrive Share Link
              <input
                className="settings-input"
                value={mobiDriveLink}
                onChange={event => setMobiDriveLink(event.target.value)}
                placeholder="https://mobidrive.com/sharelink/..."
                autoComplete="off"
              />
            </label>
            <div className="quick-actions">
              <button className="primary-button" onClick={() => saveMobiDriveLink()}>
                Save MobiDrive Link
              </button>
              <button className="secondary-button" onClick={openMobiDrive}>
                Open MobiDrive Folder
              </button>
            </div>
            {mobiDriveMessage && <div className="flow-note">{mobiDriveMessage}</div>}
          </>
        ) : storageProvider === 'google' ? (
          <>
            <h3>Google Drive</h3>

        {connected ? (
          <>
            <p><strong>Connected account:</strong> {email}</p>
            <div className="flow-note">
              Google authorization is active in this browser. OU The Builder can now verify its Drive application-data connection.
            </div>
            <button className="secondary-button" onClick={disconnectGoogleDrive}>
              Disconnect Google Drive
            </button>
          </>
        ) : (
          <>
            <p>
              Connect your Google account through Google's authorization screen. OU The Builder does not receive your Google password.
            </p>
            <button className="primary-button" onClick={connectGoogleDrive}>
              Connect Google Account
            </button>
            {googleDriveFolderLink && (
              <button className="secondary-button" onClick={() => window.open(googleDriveFolderLink, '_blank', 'noopener,noreferrer')}>
                Open Shared Google Folder
              </button>
            )}
          </>
        )}

        {message && (
          <div className="flow-note">
            {message}
          </div>
        )}
          </>
        ) : (
          <>
            <p><strong>Browser Workspace selected.</strong> Projects and files remain stored in this browser until a cloud provider is connected.</p>
            <div className="flow-note">
              Select Google Drive or MobiDrive above whenever you want to use a cloud storage option.
            </div>
          </>
        )}

        <span className="coming-soon">
          Cloud storage provider foundation
        </span>

      </section>

    </PageHeader>
  )
}

function SettingsPage({
  resetWorkspace,
  googleClientId,
  setGoogleClientId,
  googleConnected,
  googleEmail,
  googleDriveMessage,
  googleDriveFolderLink,
  setGoogleDriveFolderLink,
  saveGoogleDriveFolderLink,
  storageProvider,
  selectStorageProvider,
  mobiDriveMessage,
  mobiDriveLink,
  setMobiDriveLink,
  saveMobiDriveLink,
  openMobiDrive,
  saveGoogleClientId,
  connectGoogleDrive,
  disconnectGoogleDrive
}) {
  const [openSection, setOpenSection] = useState(null)

  return (
    <PageHeader
      eyebrow="APPLICATION"
      title="Settings"
      description="Configure OU The Builder services and connections."
    >

      <div className="settings-list">

        <SettingItem
          title="AI Agent"
          text="Choose or connect an AI agent for builder operations."
          value="Foundation"
          onClick={() => setOpenSection(openSection === 'ai' ? null : 'ai')}
        />

        {openSection === 'ai' && (
          <section className="panel settings-detail">
            <PanelHeader title="AI Agent" subtitle="Agent connection settings" />
            <p>AI agent configuration will be connected to the backend agent system. The current foundation keeps the interface ready without placing private API keys in the public GitHub Pages application.</p>
          </section>
        )}

        <SettingItem
          title="Storage"
          text="Select the storage provider used by projects."
          value={storageProvider === 'mobidrive' ? 'MobiDrive Selected' : googleConnected ? 'Google Drive Connected' : 'Local Foundation'}
          onClick={() => setOpenSection(openSection === 'storage' ? null : 'storage')}
        />

        {openSection === 'storage' && (
          <section className="panel settings-detail">
            <PanelHeader title="Storage" subtitle="Choose your storage provider" />

            <div className="quick-actions">
              <button className={storageProvider === 'google' ? 'primary-button' : 'secondary-button'} onClick={() => selectStorageProvider('google')}>Google Drive</button>
              <button className={storageProvider === 'mobidrive' ? 'primary-button' : 'secondary-button'} onClick={() => selectStorageProvider('mobidrive')}>MobiDrive</button>
              <button className={storageProvider === 'local' ? 'primary-button' : 'secondary-button'} onClick={() => selectStorageProvider('local')}>Browser Workspace</button>
            </div>

            {storageProvider === 'mobidrive' && (
              <div className="flow-note">
                MobiDrive is selected. Direct MobiDrive API/OAuth integration is not included in this foundation build yet.
              </div>
            )}

            {storageProvider === 'mobidrive' && (
              <>
                <label className="field-label">
                  MobiDrive Share Link
                  <input
                    className="settings-input"
                    value={mobiDriveLink}
                    onChange={event => setMobiDriveLink(event.target.value)}
                    placeholder="https://mobidrive.com/sharelink/..."
                    autoComplete="off"
                  />
                </label>
                <div className="quick-actions">
                  <button className="primary-button" onClick={() => saveMobiDriveLink()}>
                    Save MobiDrive Link
                  </button>
                  <button className="secondary-button" onClick={openMobiDrive}>
                    Open MobiDrive Folder
                  </button>
                </div>
              </>
            )}

            {storageProvider === 'google' && (
              <>
                <label className="field-label">
                  Google OAuth Web Client ID
                  <input
                    className="settings-input"
                    value={googleClientId}
                    onChange={event => setGoogleClientId(event.target.value)}
                    placeholder="1234567890-xxxxx.apps.googleusercontent.com"
                    autoComplete="off"
                  />
                </label>

                <label className="field-label">
                  Google Drive Shared Folder Link
                  <input
                    className="settings-input"
                    value={googleDriveFolderLink}
                    onChange={event => setGoogleDriveFolderLink(event.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    autoComplete="off"
                  />
                </label>
                <div className="quick-actions">
                  <button className="secondary-button" onClick={() => saveGoogleDriveFolderLink()}>
                    Save Folder Link
                  </button>
                  <button className="secondary-button" onClick={() => window.open(googleDriveFolderLink || 'https://drive.google.com/', '_blank', 'noopener,noreferrer')}>
                    Open Google Folder
                  </button>
                </div>

                <div className="quick-actions">
                  <button className="secondary-button" onClick={saveGoogleClientId}>
                    Save Client ID
                  </button>

                  {!googleConnected ? (
                    <button className="primary-button" onClick={connectGoogleDrive}>
                      Connect Google Account
                    </button>
                  ) : (
                    <button className="secondary-button" onClick={disconnectGoogleDrive}>
                      Disconnect Google Drive
                    </button>
                  )}
                </div>

                <div className="flow-note">
                  {googleConnected
                    ? `Connected: ${googleEmail}`
                    : 'Enter the OAuth Web Client ID from your Google Cloud project, then connect.'}
                </div>

                {googleDriveMessage && (
                  <div className="flow-note">{googleDriveMessage}</div>
                )}
              </>
            )}

            {storageProvider === 'mobidrive' && mobiDriveMessage && (
              <div className="flow-note">{mobiDriveMessage}</div>
            )}
          </section>
        )}

        <SettingItem
          title="Build Service"
          text="Remote build service configuration."
          value="GitHub Actions"
          onClick={() => setOpenSection(openSection === 'build' ? null : 'build')}
        />

        {openSection === 'build' && (
          <section className="panel settings-detail">
            <PanelHeader title="Build Service" subtitle="GitHub Actions" />
            <p>GitHub Actions is the current remote build executor. The project remains portable and the workflow remains responsible for the actual build environment.</p>
            <div className="status-list">
              <StatusRow name="Workflow" value="Configured" good />
              <StatusRow name="Node.js" value="24" good />
              <StatusRow name="Deployment" value="GitHub Pages" good />
            </div>
          </section>
        )}

        <SettingItem
          title="Application"
          text="OU The Builder Web-Based Application."
          value="v0.1.0"
          onClick={() => setOpenSection(openSection === 'app' ? null : 'app')}
        />

        {openSection === 'app' && (
          <section className="panel settings-detail">
            <PanelHeader title="Application" subtitle="Foundation information" />
            <div className="status-list">
              <StatusRow name="Application" value="OU The Builder WBA" />
              <StatusRow name="Version" value="v0.1.0" />
              <StatusRow name="Stage" value="Foundation" />
            </div>
          </section>
        )}

        <div className="setting-item">
          <div>
            <h3>Browser Workspace</h3>
            <p>Clear locally stored projects and imported files from this browser.</p>
          </div>
          <button className="danger-button" onClick={resetWorkspace}>Reset Workspace</button>
        </div>

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
  value,
  onClick
}) {
  return (
    <div
      className="setting-item"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
    >

      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>

      <span>{value} · →</span>

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
