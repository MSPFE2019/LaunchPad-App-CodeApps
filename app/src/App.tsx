import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { LaunchPadAppRecord } from './generated/models/LaunchPadAppsModel'
import { LaunchPadAppsService } from './generated/services/LaunchPadAppsService'

const STATUS_ACTIVE = 727000000

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

function App() {
  const [apps, setApps] = useState<LaunchPadAppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [audience, setAudience] = useState('All')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    async function loadApps() {
      try {
        setLoading(true)
        setError('')
        const result = await LaunchPadAppsService.getAll({
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
        })
        setApps(result.data ?? [])
      } catch (loadError) {
        console.error(loadError)
        setError('LaunchPad could not load applications from Dataverse. Refresh the page or contact support.')
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

  function launchApp(app: LaunchPadAppRecord) {
    const url = text(app.lppac_appurl)
    if (!/^https:\/\//i.test(url)) {
      setError(`"${text(app.lppac_title)}" does not have a valid HTTPS launch URL.`)
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="LaunchPad home">
          <span className="brand-mark" aria-hidden="true">LP</span>
          <span>
            <strong>LaunchPad</strong>
            <small>Application directory</small>
          </span>
        </a>
        <span className="environment-pill">Statewide services</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Find your next destination</p>
          <h1 id="hero-title">Applications, all in one place.</h1>
          <p className="hero-copy">
            Search approved tools and services, then launch them directly from your personalized directory.
          </p>

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
                  setQuery('')
                  setAudience('All')
                  setCategory('All')
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {error && <div className="message error-message" role="alert">{error}</div>}

          {loading ? (
            <div className="card-grid" aria-label="Loading applications">
              {Array.from({ length: 6 }, (_, index) => <div className="app-card skeleton" key={index} />)}
            </div>
          ) : filteredApps.length > 0 ? (
            <div className="card-grid">
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
                  <button className="launch-button" type="button" onClick={() => launchApp(app)}>
                    Launch application <span aria-hidden="true">↗</span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="message empty-state">
              <strong>No applications found</strong>
              <span>Try changing your search or filters.</span>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>LaunchPad</span>
        <span>Powered by Microsoft Power Platform</span>
      </footer>
    </div>
  )
}

export default App

