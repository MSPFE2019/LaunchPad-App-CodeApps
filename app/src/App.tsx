import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './App.css'
import type { LaunchPadAppRecord } from './generated/models/LaunchPadAppsModel'
import type { Lppac_launchpadchoices } from './generated/models/Lppac_launchpadchoicesModel'
import { LaunchPadAppsService } from './generated/services/LaunchPadAppsService'
import { Lppac_launchpadchoicesService } from './generated/services/Lppac_launchpadchoicesService'
import { Office365GroupsService } from './generated/services/Office365GroupsService'
import { Office365UsersService } from './generated/services/Office365UsersService'
import { RolesService } from './generated/services/RolesService'
import { WhoAmIService } from './generated/services/WhoAmIService'

const STATUS_ACTIVE = 727000000
const STATUS_OPTIONS = [
  { label: 'Active', value: 727000000 },
  { label: 'Maintenance', value: 727000001 },
  { label: 'Inactive', value: 727000002 },
  { label: 'Retired', value: 727000003 },
]
const CHOICE_TYPES = ['Audience', 'Category', 'App Type'] as const
type ChoiceType = (typeof CHOICE_TYPES)[number]
type CardView = 'grid' | 'list'

type AppForm = {
  title: string
  appUrl: string
  appDescription: string
  appOwner: string
  appStatus: number
  audience: string
  agencyFilter: string
  office365Group: string
  appType: string
  appUpdate: string
  category: string
}

const EMPTY_FORM: AppForm = {
  title: '',
  appUrl: '',
  appDescription: '',
  appOwner: '',
  appStatus: STATUS_ACTIVE,
  audience: '',
  agencyFilter: '',
  office365Group: '',
  appType: '',
  appUpdate: '',
  category: '',
}

function text(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

type DirectoryOption = {
  id: string
  displayName: string
  email: string
}

type DirectoryPickerProps = {
  kind: 'user' | 'group'
  label: string
  value: string
  onChange: (value: string) => void
}

function DirectoryPicker({ kind, label, value, onChange }: DirectoryPickerProps) {
  const [search, setSearch] = useState(value)
  const [results, setResults] = useState<DirectoryOption[]>([])
  const [searching, setSearching] = useState(false)
  const [pickerError, setPickerError] = useState('')
  const [open, setOpen] = useState(false)
  const skipNextValueSync = useRef(false)

  useEffect(() => {
    if (skipNextValueSync.current) {
      skipNextValueSync.current = false
      return
    }
    setSearch(value)
  }, [value])

  useEffect(() => {
    const term = search.trim()
    if (!open || term.length < 2 || term === value) {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true)
        setPickerError('')
        if (kind === 'user') {
          const response = await Office365UsersService.SearchUserV2(term, 10, true)
          if (!cancelled) {
            setResults((response.data?.value ?? [])
              .map((user) => ({
                id: user.Id,
                displayName: user.DisplayName ?? user.Mail ?? user.UserPrincipalName ?? 'Unnamed user',
                email: user.Mail ?? user.UserPrincipalName ?? '',
              }))
              .filter((user) => user.email))
          }
        } else {
          const escapedTerm = term.replaceAll("'", "''")
          const response = await Office365GroupsService.ListGroups(
            false,
            false,
            `startswith(displayName,'${escapedTerm}')`,
            10,
          )
          if (!cancelled) {
            setResults((response.data?.value ?? [])
              .map((group) => ({
                id: group.id ?? group.mail ?? '',
                displayName: group.displayName ?? group.mail ?? 'Unnamed group',
                email: group.mail ?? '',
              }))
              .filter((group) => group.email))
          }
        }
      } catch (searchError) {
        console.error(searchError)
        if (!cancelled) {
          setResults([])
          setPickerError(`Could not search Microsoft 365 ${kind === 'user' ? 'users' : 'groups'}.`)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [kind, open, search, value])

  function selectOption(option: DirectoryOption) {
    onChange(option.email)
    setSearch(option.email)
    setResults([])
    setOpen(false)
    setPickerError('')
  }

  return (
    <div className="picker-field">
      <label htmlFor={`${kind}-picker`}>{label}</label>
      <div className="directory-picker">
        <input
          id={`${kind}-picker`}
          type="search"
          autoComplete="off"
          placeholder={`Search Microsoft 365 ${kind === 'user' ? 'users' : 'groups'}`}
          value={search}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            const nextSearch = event.target.value
            setSearch(nextSearch)
            if (nextSearch.trim().length < 2) setResults([])
            if (value) {
              skipNextValueSync.current = true
              onChange('')
            }
            setOpen(true)
          }}
          aria-expanded={open && results.length > 0}
          aria-controls={`${kind}-picker-results`}
        />
        {searching && <span className="picker-loading">Searching…</span>}
        {open && results.length > 0 && (
          <div className="picker-results" id={`${kind}-picker-results`} role="listbox">
            {results.map((option) => (
              <button key={option.id} type="button" role="option" onMouseDown={() => selectOption(option)}>
                <span className="picker-avatar" aria-hidden="true">{getInitials(option.displayName)}</span>
                <span><strong>{option.displayName}</strong><small>{option.email}</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
      {pickerError && <small className="picker-error" role="alert">{pickerError}</small>}
      {!pickerError && search.trim().length === 1 && <small className="picker-hint">Type at least 2 characters.</small>}
    </div>
  )
}

function App() {
  const [apps, setApps] = useState<LaunchPadAppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState('All')
  const [category, setCategory] = useState('All')
  const [cardView, setCardView] = useState<CardView>('grid')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AppForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [choices, setChoices] = useState<Lppac_launchpadchoices[]>([])
  const [showChoiceManager, setShowChoiceManager] = useState(false)
  const [newChoiceType, setNewChoiceType] = useState<ChoiceType>('Audience')
  const [newChoiceValue, setNewChoiceValue] = useState('')
  const [savingChoice, setSavingChoice] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [detailApp, setDetailApp] = useState<LaunchPadAppRecord | null>(null)

  useEffect(() => {
    async function loadApps() {
      try {
        setLoading(true)
        setError('')
        const [appsResult, choicesResult] = await Promise.all([
          LaunchPadAppsService.getAll({
            select: [
              'lppac_launchpadappid',
              'lppac_title',
              'lppac_appurl',
              'lppac_appdescription',
              'lppac_appowner',
              'lppac_appstatus',
              'lppac_audience',
              'lppac_agencyfilter',
              'lppac_office365group',
              'lppac_licensedesignation',
              'lppac_appid',
              'lppac_apptype',
              'lppac_appversion',
              'lppac_appupdate',
              'lppac_category',
            ],
            filter: `lppac_appstatus eq ${STATUS_ACTIVE}`,
            orderBy: ['lppac_title asc'],
            top: 500,
          }),
          Lppac_launchpadchoicesService.getAll({
            select: ['lppac_launchpadchoiceid', 'lppac_choicetype', 'lppac_value', 'statecode'],
            filter: 'statecode eq 0',
            orderBy: ['lppac_choicetype asc', 'lppac_value asc'],
            top: 500,
          }),
        ])
        setApps(appsResult.data ?? [])
        setChoices(choicesResult.data ?? [])

        const identityResult = await WhoAmIService.WhoAmI()
        const userId = typeof identityResult.data?.UserId === 'string' ? identityResult.data.UserId : ''
        if (userId) {
          const roleResult = await RolesService.getAll({
            select: ['roleid', 'name'],
            filter: `name eq 'LaunchPad Admin' and systemuserroles_association/any(user:user/systemuserid eq ${userId})`,
            top: 1,
          })
          setCanManage((roleResult.data?.length ?? 0) > 0)
        }
      } catch (loadError) {
        console.error(loadError)
        setError('Launch App could not load applications from Dataverse. Refresh the page or contact support.')
      } finally {
        setLoading(false)
      }
    }

    void loadApps()
  }, [])

  const audiences = useMemo(
    () => ['All', ...Array.from(new Set(apps.map((app) => text(app.lppac_audience)).filter(Boolean))).sort()],
    [apps],
  )

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(apps.map((app) => text(app.lppac_category)).filter(Boolean))).sort()],
    [apps],
  )

  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return apps.filter((app) => {
      const matchesAudience = audience === 'All' || text(app.lppac_audience) === audience
      const matchesCategory = category === 'All' || text(app.lppac_category) === category
      const searchable = [
        app.lppac_title,
        app.lppac_appdescription,
        app.lppac_category,
        app.lppac_audience,
        app.lppac_apptype,
        app.lppac_appowner,
      ]
        .map(text)
        .join(' ')
        .toLowerCase()

      return matchesAudience && matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [apps, audience, category, query])

  const metrics = useMemo(() => ({
    applications: apps.length,
    categories: new Set(apps.map((app) => text(app.lppac_category)).filter(Boolean)).size,
    owners: new Set(apps.map((app) => text(app.lppac_appowner).toLowerCase()).filter(Boolean)).size,
  }), [apps])

  function clearFilters() {
    setQuery('')
    setAudience('All')
    setCategory('All')
  }

  function choiceValues(type: ChoiceType) {
    return choices
      .filter((choice) => choice.lppac_choicetype === type)
      .map((choice) => choice.lppac_value)
      .sort((left, right) => left.localeCompare(right))
  }

  function launchApp(app: LaunchPadAppRecord) {
    const url = text(app.lppac_appurl)
    if (!/^https:\/\//i.test(url)) {
      setError(`"${text(app.lppac_title)}" does not have a valid HTTPS launch URL.`)
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function updateForm<K extends keyof AppForm>(field: K, value: AppForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function closeForm() {
    if (saving) return
    setShowForm(false)
    setEditingId('')
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function editApp(app: LaunchPadAppRecord) {
    setEditingId(app.lppac_launchpadappid)
    setForm({
      title: text(app.lppac_title),
      appUrl: text(app.lppac_appurl),
      appDescription: text(app.lppac_appdescription),
      appOwner: text(app.lppac_appowner),
      appStatus: app.lppac_appstatus ?? STATUS_ACTIVE,
      audience: text(app.lppac_audience),
      agencyFilter: text(app.lppac_agencyfilter),
      office365Group: text(app.lppac_office365group),
      appType: text(app.lppac_apptype),
      appUpdate: text(app.lppac_appupdate),
      category: text(app.lppac_category),
    })
    setFormError('')
    setShowForm(true)
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSuccessMessage('')

    if (!/^https:\/\//i.test(form.appUrl.trim())) {
      setFormError('App URL must begin with https://.')
      return
    }

    try {
      setSaving(true)
      const values = {
        lppac_title: form.title.trim(),
        lppac_appurl: form.appUrl.trim(),
        lppac_appdescription: form.appDescription.trim(),
        lppac_appowner: form.appOwner.trim() || null,
        lppac_appstatus: form.appStatus,
        lppac_audience: form.audience.trim(),
        lppac_agencyfilter: form.agencyFilter.trim() || null,
        lppac_office365group: form.office365Group.trim() || null,
        lppac_apptype: form.appType.trim(),
        lppac_appupdate: form.appUpdate.trim() || null,
        lppac_category: form.category.trim() || null,
      }
      const result = editingId
        ? await LaunchPadAppsService.update(editingId, values)
        : await LaunchPadAppsService.create(values)

      if (!result.data) {
        throw new Error('Dataverse did not return the created record.')
      }

      if (editingId) {
        setApps((current) =>
          form.appStatus === STATUS_ACTIVE
            ? current
              .map((app) => app.lppac_launchpadappid === editingId ? result.data : app)
              .sort((left, right) => text(left.lppac_title).localeCompare(text(right.lppac_title)))
            : current.filter((app) => app.lppac_launchpadappid !== editingId),
        )
      } else if (form.appStatus === STATUS_ACTIVE) {
        setApps((current) =>
          [...current, result.data].sort((left, right) =>
            text(left.lppac_title).localeCompare(text(right.lppac_title)),
          ),
        )
      }
      setSuccessMessage(`"${form.title.trim()}" was ${editingId ? 'updated' : 'added'} in Dataverse.`)
      setShowForm(false)
      setEditingId('')
      setForm(EMPTY_FORM)
    } catch (saveError) {
      console.error(saveError)
      setFormError('The application could not be saved to Dataverse. Check your permissions and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function addChoice() {
    const value = newChoiceValue.trim()
    setFormError('')
    if (!value) {
      setFormError('Enter a value for the dropdown choice.')
      return
    }

    const duplicate = choices.some(
      (choice) =>
        choice.lppac_choicetype === newChoiceType &&
        choice.lppac_value.toLowerCase() === value.toLowerCase(),
    )
    if (duplicate) {
      setFormError(`"${value}" already exists in ${newChoiceType}.`)
      return
    }

    try {
      setSavingChoice(true)
      const result = await Lppac_launchpadchoicesService.create({
        lppac_choicetype: newChoiceType,
        lppac_value: value,
        statecode: 0,
        statuscode: 1,
      })
      if (!result.data) {
        throw new Error('Dataverse did not return the created choice.')
      }

      setChoices((current) => [...current, result.data])
      if (newChoiceType === 'Audience') updateForm('audience', value)
      if (newChoiceType === 'Category') updateForm('category', value)
      if (newChoiceType === 'App Type') updateForm('appType', value)
      setNewChoiceValue('')
    } catch (choiceError) {
      console.error(choiceError)
      setFormError('The dropdown choice could not be saved. Check your Dataverse permissions and try again.')
    } finally {
      setSavingChoice(false)
    }
  }

  async function removeApp(app: LaunchPadAppRecord) {
    const id = app.lppac_launchpadappid
    const title = text(app.lppac_title)
    if (!window.confirm(`Remove "${title}" from Launch App? This deletes the Dataverse record.`)) return

    try {
      setDeletingId(id)
      setError('')
      await LaunchPadAppsService.delete(id)
      setApps((current) => current.filter((item) => item.lppac_launchpadappid !== id))
      setSuccessMessage(`"${title}" was removed from Dataverse.`)
    } catch (deleteError) {
      console.error(deleteError)
      setError('The application could not be removed. Confirm that you have the LaunchPad Admin role.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Launch App home">
          <span className="brand-mark" aria-hidden="true">LA</span>
          <span>
            <strong>Launch App</strong>
            <small>Application directory</small>
          </span>
        </a>
        <div className="topbar-actions">
          {canManage && (
            <button className="add-button" type="button" onClick={() => setShowForm(true)}>
              Add application
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Applications, all in one place.</h1>

          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search applications</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, category, owner, or description"
            />
          </label>
        </section>

        <section className="directory" aria-labelledby="directory-title">
          <dl className="metrics" aria-label="Directory summary">
            <div><dt>Applications</dt><dd>{loading ? '—' : metrics.applications}</dd></div>
            <div><dt>Categories</dt><dd>{loading ? '—' : metrics.categories}</dd></div>
            <div><dt>Owners</dt><dd>{loading ? '—' : metrics.owners}</dd></div>
          </dl>

          {successMessage && (
            <div className="message success-message" role="status">
              {successMessage}
            </div>
          )}
          <div className="directory-header">
            <div>
              <p className="eyebrow">Directory</p>
              <h2 id="directory-title">Available applications</h2>
            </div>
            <p className="result-count" aria-live="polite">
              {loading ? 'Loading…' : `${filteredApps.length} ${filteredApps.length === 1 ? 'application' : 'applications'}`}
            </p>
          </div>

          <div className="filters" aria-label="Application filters">
            <label>
              <span>Audience</span>
              <select value={audience} onChange={(event) => setAudience(event.target.value)}>
                {audiences.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            {(query || audience !== 'All' || category !== 'All') && (
              <button
                className="clear-button"
                type="button"
                onClick={() => {
                  clearFilters()
                }}
              >
                Clear filters
              </button>
            )}
            <div className="view-controls" role="group" aria-label="Application card view">
              <button
                type="button"
                aria-pressed={cardView === 'grid'}
                onClick={() => setCardView('grid')}
              >
                <span aria-hidden="true">▦</span> Grid
              </button>
              <button
                type="button"
                aria-pressed={cardView === 'list'}
                onClick={() => setCardView('list')}
              >
                <span aria-hidden="true">☰</span> List
              </button>
            </div>
          </div>

          {error && <div className="message error-message" role="alert">{error}</div>}

          {loading ? (
            <div className={`card-grid card-grid--${cardView}`} aria-label="Loading applications">
              {Array.from({ length: 6 }, (_, index) => <div className="app-card skeleton" key={index} />)}
            </div>
          ) : filteredApps.length > 0 ? (
            <div className={`card-grid card-grid--${cardView}`}>
              {filteredApps.map((app) => (
                <article className="app-card" key={app.lppac_launchpadappid}>
                  <div className="card-topline">
                    <span className="app-icon" aria-hidden="true">{getInitials(text(app.lppac_title)) || 'AP'}</span>
                    <span className="status"><i /> Active</span>
                  </div>
                  <div className="card-content">
                    <p className="category">{text(app.lppac_category) || text(app.lppac_apptype) || 'Application'}</p>
                    <h3>{text(app.lppac_title)}</h3>
                    <p className="description">{text(app.lppac_appdescription)}</p>
                    <dl>
                      {app.lppac_audience && <><dt>Audience</dt><dd>{app.lppac_audience}</dd></>}
                      {app.lppac_appowner && <><dt>Owner</dt><dd>{app.lppac_appowner}</dd></>}
                      {app.lppac_appversion && <><dt>Version</dt><dd>{app.lppac_appversion}</dd></>}
                    </dl>
                  </div>
                  <div className="card-actions">
                    <button className="launch-button" type="button" onClick={() => launchApp(app)}>
                      Launch App <span aria-hidden="true">↗</span>
                    </button>
                    <button className="details-button" type="button" onClick={() => setDetailApp(app)}>
                      View details
                    </button>
                    {canManage && (
                      <details className="overflow-menu">
                        <summary aria-label={`Manage ${text(app.lppac_title)}`}>•••</summary>
                        <div>
                          <button type="button" onClick={() => editApp(app)}>Edit</button>
                          <button
                            className="delete-menu-item"
                            type="button"
                            disabled={deletingId === app.lppac_launchpadappid}
                            onClick={() => removeApp(app)}
                          >
                            {deletingId === app.lppac_launchpadappid ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="message empty-state">
              <strong>No applications found</strong>
              <span>Try:</span>
              <ul>
                <li>Using different keywords</li>
                <li>Changing the audience or category</li>
                <li>Clearing all filters</li>
              </ul>
              <button className="empty-clear-button" type="button" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm()
        }}>
          <section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
            <div className="form-header">
              <div>
                <p className="eyebrow">Dataverse entry</p>
                <h2 id="form-title">{editingId ? 'Edit application' : 'Add an application'}</h2>
              </div>
              <button className="close-button" type="button" onClick={closeForm} aria-label="Close form">
                ×
              </button>
            </div>

            <form onSubmit={submitForm}>
              {formError && <div className="message error-message" role="alert">{formError}</div>}

              <div className="choice-manager">
                <button
                  className="choice-manager-toggle"
                  type="button"
                  aria-expanded={showChoiceManager}
                  onClick={() => setShowChoiceManager((current) => !current)}
                >
                  <span>
                    <strong>Manage dropdown choices</strong>
                    <small>Add Audience, Category, or App Type values.</small>
                  </span>
                  <span aria-hidden="true">{showChoiceManager ? '−' : '+'}</span>
                </button>
                {showChoiceManager && (
                  <div className="choice-manager-fields">
                    <label>
                      <span>Choice type</span>
                      <select value={newChoiceType} onChange={(event) => setNewChoiceType(event.target.value as ChoiceType)}>
                        {CHOICE_TYPES.map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>New value</span>
                      <input maxLength={200} value={newChoiceValue} onChange={(event) => setNewChoiceValue(event.target.value)} />
                    </label>
                    <button className="add-choice-button" type="button" onClick={addChoice} disabled={savingChoice}>
                      {savingChoice ? 'Adding…' : 'Add choice'}
                    </button>
                  </div>
                )}
              </div>

              <div className="form-grid">
                <label>
                  <span>Title <b aria-hidden="true">*</b></span>
                  <input required maxLength={200} value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
                </label>
                <label>
                  <span>App URL <b aria-hidden="true">*</b></span>
                  <input required type="url" placeholder="https://..." maxLength={500} value={form.appUrl} onChange={(event) => updateForm('appUrl', event.target.value)} />
                </label>
                <label className="full-width">
                  <span>App description <b aria-hidden="true">*</b></span>
                  <textarea required rows={4} maxLength={4000} value={form.appDescription} onChange={(event) => updateForm('appDescription', event.target.value)} />
                </label>
                <label>
                  <span>Audience <b aria-hidden="true">*</b></span>
                  <select required value={form.audience} onChange={(event) => updateForm('audience', event.target.value)}>
                    <option value="">Select audience</option>
                    {choiceValues('Audience').map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span>App type <b aria-hidden="true">*</b></span>
                  <select required value={form.appType} onChange={(event) => updateForm('appType', event.target.value)}>
                    <option value="">Select app type</option>
                    {choiceValues('App Type').map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span>App status</span>
                  <select value={form.appStatus} onChange={(event) => updateForm('appStatus', Number(event.target.value))}>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Category</span>
                  <select value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
                    <option value="">Select category</option>
                    {choiceValues('Category').map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <DirectoryPicker
                  kind="user"
                  label="App owner"
                  value={form.appOwner}
                  onChange={(value) => updateForm('appOwner', value)}
                />
                <DirectoryPicker
                  kind="group"
                  label="Microsoft 365 group"
                  value={form.office365Group}
                  onChange={(value) => updateForm('office365Group', value)}
                />
                <label>
                  <span>Agency filter</span>
                  <input maxLength={500} placeholder="Department, company, or email domain" value={form.agencyFilter} onChange={(event) => updateForm('agencyFilter', event.target.value)} />
                </label>
                <label className="full-width">
                  <span>App update notes</span>
                  <textarea rows={3} maxLength={2000} value={form.appUpdate} onChange={(event) => updateForm('appUpdate', event.target.value)} />
                </label>
              </div>

              <p className="required-note"><b>*</b> Required field</p>
              <div className="form-actions">
                <button className="cancel-button" type="button" onClick={closeForm} disabled={saving}>Cancel</button>
                <button className="save-button" type="submit" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailApp && (
        <div className="modal-backdrop details-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailApp(null)
        }}>
          <section className="details-dialog" role="dialog" aria-modal="true" aria-labelledby="details-title">
            <div className="form-header">
              <div>
                <p className="eyebrow">{text(detailApp.lppac_category) || 'Application'}</p>
                <h2 id="details-title">{text(detailApp.lppac_title)}</h2>
              </div>
              <button className="close-button" type="button" onClick={() => setDetailApp(null)} aria-label="Close details">×</button>
            </div>
            <div className="details-content">
              <p>{text(detailApp.lppac_appdescription)}</p>
              <dl>
                <dt>Audience</dt><dd>{text(detailApp.lppac_audience) || 'Not specified'}</dd>
                <dt>App type</dt><dd>{text(detailApp.lppac_apptype) || 'Not specified'}</dd>
                <dt>Owner</dt><dd>{text(detailApp.lppac_appowner) || 'Not specified'}</dd>
                <dt>Agency filter</dt><dd>{text(detailApp.lppac_agencyfilter) || 'Not specified'}</dd>
              </dl>
              <button className="add-button" type="button" onClick={() => launchApp(detailApp)}>Launch App ↗</button>
            </div>
          </section>
        </div>
      )}

      <footer>
        <span>Launch App</span>
        <span className="footer-links">
          <a href="https://github.com/MSPFE2019/LaunchPad-App-CodeApps" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span>Powered by Microsoft Power Platform</span>
        </span>
      </footer>
    </div>
  )
}

export default App
