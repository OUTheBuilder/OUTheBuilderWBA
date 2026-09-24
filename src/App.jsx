      - name: Enable functional Settings
        shell: bash
        run: |
          python3 - <<'PY'
          from pathlib import Path
          import re

          path = Path("src/App.jsx")
          text = path.read_text()

          settings_page = r'''function SettingsPage() {
            const [activeSetting, setActiveSetting] = useState(null)
            const [agent, setAgent] = useState(() => {
              return localStorage.getItem('ou_builder_agent') || 'OU Builder AI'
            })
            const [storage, setStorage] = useState(() => {
              return localStorage.getItem('ou_builder_storage') || 'Local Browser Storage'
            })
            const [buildService, setBuildService] = useState(() => {
              return localStorage.getItem('ou_builder_build_service') || 'GitHub Actions'
            })
            const [customAgentName, setCustomAgentName] = useState('')
            const [customAgentProvider, setCustomAgentProvider] = useState('OpenAI-compatible API')

            function saveAgent(value) {
              setAgent(value)
              localStorage.setItem('ou_builder_agent', value)
              setActiveSetting(null)
            }

            function saveStorage(value) {
              setStorage(value)
              localStorage.setItem('ou_builder_storage', value)
              setActiveSetting(null)
            }

            function saveBuildService(value) {
              setBuildService(value)
              localStorage.setItem('ou_builder_build_service', value)
              setActiveSetting(null)
            }

            function addCustomAgent() {
              const name = customAgentName.trim()

              if (!name) {
                window.alert('Please enter an agent name.')
                return
              }

              const savedAgents = JSON.parse(
                localStorage.getItem('ou_builder_custom_agents') || '[]'
              )

              const newAgent = {
                name,
                provider: customAgentProvider
              }

              const updatedAgents = [
                ...savedAgents.filter(item => item.name !== name),
                newAgent
              ]

              localStorage.setItem(
                'ou_builder_custom_agents',
                JSON.stringify(updatedAgents)
              )

              saveAgent(name)
              setCustomAgentName('')
            }

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
                    value={agent}
                    onClick={() => setActiveSetting('agent')}
                  />

                  <SettingItem
                    title="Storage"
                    text="Select the storage provider used by projects."
                    value={storage}
                    onClick={() => setActiveSetting('storage')}
                  />

                  <SettingItem
                    title="Build Service"
                    text="Remote build service configuration."
                    value={buildService}
                    onClick={() => setActiveSetting('build')}
                  />

                  <SettingItem
                    title="Application"
                    text="OU The Builder Web-Based Application."
                    value="v0.4.4"
                    onClick={() => setActiveSetting('application')}
                  />

                </div>

                {activeSetting && (
                  <div
                    className="settings-modal-backdrop"
                    onClick={() => setActiveSetting(null)}
                  >
                    <div
                      className="settings-modal"
                      onClick={event => event.stopPropagation()}
                    >

                      {activeSetting === 'agent' && (
                        <>
                          <div className="settings-modal-header">
                            <div>
                              <span className="settings-modal-eyebrow">
                                AI CONTROL
                              </span>
                              <h2>AI Agent</h2>
                              <p>Select the agent used by OU The Builder.</p>
                            </div>

                            <button
                              className="modal-close"
                              onClick={() => setActiveSetting(null)}
                            >
                              ×
                            </button>
                          </div>

                          <div className="settings-option-list">

                            {[
                              'OU Builder AI',
                              'Coding Agent',
                              'General AI',
                              'Research Agent',
                              'Free Auto Agent'
                            ].map(item => (
                              <button
                                key={item}
                                className={
                                  `settings-option ${
                                    agent === item ? 'selected' : ''
                                  }`
                                }
                                onClick={() => saveAgent(item)}
                              >
                                <span>{item}</span>
                                <span>{agent === item ? '✓' : '→'}</span>
                              </button>
                            ))}

                          </div>

                          <div className="settings-divider" />

                          <h3>Add Custom Agent</h3>

                          <input
                            className="settings-input"
                            value={customAgentName}
                            onChange={event =>
                              setCustomAgentName(event.target.value)
                            }
                            placeholder="Agent name"
                          />

                          <select
                            className="settings-input"
                            value={customAgentProvider}
                            onChange={event =>
                              setCustomAgentProvider(event.target.value)
                            }
                          >
                            <option>OpenAI-compatible API</option>
                            <option>OpenRouter</option>
                            <option>Google AI</option>
                            <option>Custom Endpoint</option>
                            <option>GitHub Repository</option>
                            <option>Local / Uploaded Model</option>
                          </select>

                          <button
                            className="primary-button full"
                            onClick={addCustomAgent}
                          >
                            ＋ Add Agent
                          </button>
                        </>
                      )}

                      {activeSetting === 'storage' && (
                        <>
                          <div className="settings-modal-header">
                            <div>
                              <span className="settings-modal-eyebrow">
                                STORAGE
                              </span>
                              <h2>Storage</h2>
                              <p>Choose where project information is managed.</p>
                            </div>

                            <button
                              className="modal-close"
                              onClick={() => setActiveSetting(null)}
                            >
                              ×
                            </button>
                          </div>

                          <div className="settings-option-list">

                            {[
                              'Local Browser Storage',
                              'Google Drive',
                              'Cloud Storage'
                            ].map(item => (
                              <button
                                key={item}
                                className={
                                  `settings-option ${
                                    storage === item ? 'selected' : ''
                                  }`
                                }
                                onClick={() => {
                                  if (item === 'Google Drive') {
                                    window.alert(
                                      'Google Drive connection will be enabled when the secure Google OAuth backend is connected.'
                                    )
                                    return
                                  }

                                  if (item === 'Cloud Storage') {
                                    window.alert(
                                      'Cloud Storage will be enabled when the OU The Builder backend is connected.'
                                    )
                                    return
                                  }

                                  saveStorage(item)
                                }}
                              >
                                <span>{item}</span>
                                <span>{storage === item ? '✓' : '→'}</span>
                              </button>
                            ))}

                          </div>
                        </>
                      )}

                      {activeSetting === 'build' && (
                        <>
                          <div className="settings-modal-header">
                            <div>
                              <span className="settings-modal-eyebrow">
                                BUILD SYSTEM
                              </span>
                              <h2>Build Service</h2>
                              <p>Configure the remote build executor.</p>
                            </div>

                            <button
                              className="modal-close"
                              onClick={() => setActiveSetting(null)}
                            >
                              ×
                            </button>
                          </div>

                          <div className="settings-option-list">

                            {[
                              'GitHub Actions',
                              'Remote Build API',
                              'Manual Export'
                            ].map(item => (
                              <button
                                key={item}
                                className={
                                  `settings-option ${
                                    buildService === item ? 'selected' : ''
                                  }`
                                }
                                onClick={() => saveBuildService(item)}
                              >
                                <span>{item}</span>
                                <span>
                                  {buildService === item ? '✓' : '→'}
                                </span>
                              </button>
                            ))}

                          </div>

                          <div className="settings-info-box">
                            <strong>Current build system</strong>
                            <span>
                              GitHub Actions is currently the remote automation
                              foundation for OU The Builder.
                            </span>
                          </div>
                        </>
                      )}

                      {activeSetting === 'application' && (
                        <>
                          <div className="settings-modal-header">
                            <div>
                              <span className="settings-modal-eyebrow">
                                SYSTEM
                              </span>
                              <h2>OU The Builder</h2>
                              <p>Application information.</p>
                            </div>

                            <button
                              className="modal-close"
                              onClick={() => setActiveSetting(null)}
                            >
                              ×
                            </button>
                          </div>

                          <div className="settings-info-grid">

                            <div>
                              <span>Application</span>
                              <strong>OU The Builder WBA</strong>
                            </div>

                            <div>
                              <span>Version</span>
                              <strong>0.4.4</strong>
                            </div>

                            <div>
                              <span>Runtime</span>
                              <strong>Web Application</strong>
                            </div>

                            <div>
                              <span>Build Automation</span>
                              <strong>GitHub Actions</strong>
                            </div>

                          </div>
                        </>
                      )}

                    </div>
                  </div>
                )}
              </PageHeader>
            )
          }'''

          setting_item = r'''function SettingItem({
            title,
            text,
            value,
            onClick
          }) {
            return (
              <button
                type="button"
                className="setting-item"
                onClick={onClick}
              >
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>

                <span className="setting-item-value">
                  {value}
                  <span className="setting-item-arrow">→</span>
                </span>
              </button>
            )
          }'''

          original_settings_pattern = (
              r'function SettingsPage\(\) \{.*?'
              r'\nfunction FeatureCard\('
          )

          replacement_settings = settings_page + '\n\nfunction FeatureCard('

          updated, count = re.subn(
              original_settings_pattern,
              replacement_settings,
              text,
              count=1,
              flags=re.S
          )

          if count != 1:
              raise SystemExit(
                  'ERROR: Could not locate SettingsPage in src/App.jsx'
              )

          original_item_pattern = (
              r'function SettingItem\(\{.*?'
              r'\nfunction formatBytes\('
          )

          replacement_item = setting_item + '\n\nfunction formatBytes('

          updated, count = re.subn(
              original_item_pattern,
              replacement_item,
              updated,
              count=1,
              flags=re.S
          )

          if count != 1:
              raise SystemExit(
                  'ERROR: Could not locate SettingItem in src/App.jsx'
              )

          path.write_text(updated)

          print('Functional Settings successfully applied.')
          PY

      - name: Add Settings UI styles
        shell: bash
        run: |
          cat >> src/App.css <<'EOF'

          .setting-item {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            text-align: left;
            cursor: pointer;
            border: 0;
            color: inherit;
            font: inherit;
          }

          .setting-item-value {
            display: flex;
            align-items: center;
            gap: 12px;
            white-space: nowrap;
          }

          .setting-item-arrow {
            opacity: .7;
            transition: transform .2s ease;
          }

          .setting-item:hover .setting-item-arrow {
            transform: translateX(4px);
          }

          .settings-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(2, 5, 18, .78);
            backdrop-filter: blur(10px);
          }

          .settings-modal {
            width: min(620px, 100%);
            max-height: 90vh;
            overflow: auto;
            padding: 24px;
            border: 1px solid rgba(74, 144, 255, .35);
            border-radius: 20px;
            background: linear-gradient(
              145deg,
              rgba(12, 20, 45, .98),
              rgba(5, 9, 24, .98)
            );
            box-shadow:
              0 0 40px rgba(47, 102, 255, .16),
              0 20px 70px rgba(0, 0, 0, .5);
          }

          .settings-modal-header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          .settings-modal-header h2 {
            margin: 4px 0 8px;
          }

          .settings-modal-header p {
            margin: 0;
            opacity: .72;
          }

          .settings-modal-eyebrow {
            font-size: 11px;
            letter-spacing: .14em;
            opacity: .62;
          }

          .modal-close {
            width: 38px;
            height: 38px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 10px;
            background: rgba(255,255,255,.04);
            color: inherit;
            font-size: 24px;
            cursor: pointer;
          }

          .settings-option-list {
            display: grid;
            gap: 10px;
          }

          .settings-option {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            padding: 15px 16px;
            border: 1px solid rgba(255,255,255,.1);
            border-radius: 12px;
            background: rgba(255,255,255,.035);
            color: inherit;
            text-align: left;
            cursor: pointer;
          }

          .settings-option:hover,
          .settings-option.selected {
            border-color: rgba(73, 150, 255, .55);
            background: rgba(48, 106, 255, .12);
          }

          .settings-divider {
            height: 1px;
            margin: 24px 0;
            background: rgba(255,255,255,.1);
          }

          .settings-input {
            width: 100%;
            box-sizing: border-box;
            margin: 8px 0;
            padding: 13px 14px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 10px;
            background: rgba(0,0,0,.22);
            color: inherit;
            font: inherit;
          }

          .settings-info-box {
            display: grid;
            gap: 7px;
            margin-top: 20px;
            padding: 15px;
            border: 1px solid rgba(0, 210, 255, .16);
            border-radius: 12px;
            background: rgba(0, 180, 255, .05);
          }

          .settings-info-box span {
            opacity: .7;
            line-height: 1.5;
          }

          .settings-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .settings-info-grid > div {
            display: grid;
            gap: 6px;
            padding: 15px;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 12px;
            background: rgba(255,255,255,.035);
          }

          .settings-info-grid span {
            font-size: 12px;
            opacity: .58;
          }

          @media (max-width: 600px) {
            .settings-modal {
              padding: 18px;
            }

            .settings-info-grid {
              grid-template-columns: 1fr;
            }

            .setting-item {
              align-items: flex-start;
            }

            .setting-item-value {
              font-size: 12px;
            }
          }

          EOF
