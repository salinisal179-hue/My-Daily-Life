import { useEffect, useState } from 'react'
import fallbackImage from './assets/hero.png'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function getBlogIdFromPath() {
  return window.location.pathname.match(/^\/blog\/([^/]+)\/?$/)?.[1] || ''
}

function getBlogCategory(blog) {
  const text = `${blog.title} ${blog.content}`.toLowerCase()
  if (/\b(ai|software|tech|app|website|digital|data|development|innovation)\b/.test(text)) return 'Technology'
  if (/\b(life|daily|travel|food|health|wellness|habit|personal|story)\b/.test(text)) return 'Lifestyle'
  if (/\b(softrate|company|team|launch|project|client|work)\b/.test(text)) return 'Company updates'
  return 'Business'
}

function handleBlogImageError(event) {
  event.currentTarget.onerror = null
  event.currentTarget.src = fallbackImage
}

function App() {
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All stories')
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '')
  const [page, setPage] = useState(() => {
    if (getBlogIdFromPath()) return 'blog'
    if (window.location.hash) return 'home'
    return localStorage.getItem('adminToken') ? 'admin' : 'home'
  })
  const [activeSection, setActiveSection] = useState(() => {
    if (getBlogIdFromPath()) return 'blogs'
    return window.location.hash.slice(1) || (localStorage.getItem('adminToken') ? 'admin' : 'home')
  })
  const [navOpen, setNavOpen] = useState(false)
  const [selectedBlogId, setSelectedBlogId] = useState(getBlogIdFromPath)
  const [selectedBlog, setSelectedBlog] = useState(null)
  const [blogLoading, setBlogLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [showBlogForm, setShowBlogForm] = useState(false)
  const [pendingSection, setPendingSection] = useState('')
  const categories = ['All stories', ...new Set(blogs.map(getBlogCategory))]
  const filteredBlogs = blogs.filter((blog) => {
    const matchesCategory = activeCategory === 'All stories' || getBlogCategory(blog) === activeCategory
    const matchesSearch = `${blog.title} ${blog.content}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
    return matchesCategory && matchesSearch
  })

  async function loadBlogs() {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/blogs`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not load blogs.')
      setBlogs(data)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBlogs()
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const blogId = getBlogIdFromPath()
      const section = blogId ? 'blogs' : window.location.hash.slice(1) || (token ? 'admin' : 'home')
      setSelectedBlogId(blogId)
      setPage(blogId ? 'blog' : section === 'admin' && token ? 'admin' : 'home')
      setActiveSection(section)
      setNavOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [token])

  useEffect(() => {
    if (page === 'home' && pendingSection) {
      document.getElementById(pendingSection)?.scrollIntoView()
      setPendingSection('')
    }
  }, [page, pendingSection])

  useEffect(() => {
    if (!imagePreview) return undefined
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  useEffect(() => {
    if (!selectedBlogId) {
      setSelectedBlog(null)
      return
    }

    let active = true
    async function loadBlog() {
      setBlogLoading(true)
      try {
        const response = await fetch(`${API_URL}/api/blogs/${selectedBlogId}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Could not load this blog.')
        if (active) setSelectedBlog(data)
      } catch (error) {
        if (active) setMessage(error.message)
      } finally {
        if (active) setBlogLoading(false)
      }
    }

    loadBlog()
    return () => { active = false }
  }, [selectedBlogId])

  async function handleLogin(event) {
    event.preventDefault()
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Login failed.')
      localStorage.setItem('adminToken', data.token)
      setToken(data.token)
      setPage('admin')
      setActiveSection('admin')
      setPassword('')
    } catch (error) {
      setMessage(error.message)
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken')
    setToken('')
    setPage('home')
    setActiveSection('home')
    setShowBlogForm(false)
    setMessage('')
  }

  function openBlog(event, blogId) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    window.history.pushState({}, '', `/blog/${blogId}`)
    setSelectedBlogId(blogId)
    setPage('blog')
    setActiveSection('blogs')
    setNavOpen(false)
    setMessage('')
  }

  function navigateToSection(section) {
    window.history.pushState({}, '', section === 'home' ? '/' : `/#${section}`)
    setSelectedBlogId('')
    setPage('home')
    setActiveSection(section)
    setNavOpen(false)
    setPendingSection(section)
    setMessage('')
  }

  function openAdmin() {
    window.history.pushState({}, '', '/')
    setSelectedBlogId('')
    setPage(token ? 'admin' : 'login')
    setActiveSection('admin')
    setNavOpen(false)
  }

  function resetForm(form) {
    form.reset()
    setTitle('')
    setContent('')
    setImage(null)
    setImagePreview('')
  }

  function handleImageChange(event) {
    const selectedImage = event.target.files[0] || null
    setImage(selectedImage)
    setImagePreview(selectedImage ? URL.createObjectURL(selectedImage) : '')
  }

  async function handleSaveBlog(event) {
    event.preventDefault()
    setMessage('')
    const form = event.currentTarget
    const formData = new FormData()
    formData.append('title', title)
    formData.append('content', content)
    if (image) formData.append('image', image)

    try {
      const response = await fetch(`${API_URL}/api/blogs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not save blog.')
      resetForm(form)
      setShowBlogForm(false)
      setMessage('Blog uploaded.')
      await loadBlogs()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function handleDelete(blogId) {
    if (!window.confirm('Delete this blog?')) return
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/blogs/${blogId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not delete blog.')
      setMessage('Blog deleted.')
      await loadBlogs()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <>
      <header className="bg-dark">
        <nav className="navbar navbar-expand-lg navbar-dark container py-3" aria-label="Main navigation">
          <a className="navbar-brand d-flex align-items-center gap-2 fw-bold fs-4" href="/" onClick={(event) => { event.preventDefault(); navigateToSection('home') }}>
            <img src="/blog-logo.svg" alt="" width="40" height="40" />
            <span>
              My Daily Life<span className="text-info">.</span>
              <span className="d-block small fw-normal text-white-50">Stories for curious minds</span>
            </span>
          </a>
          <button className="navbar-toggler" type="button" aria-controls="mainNavigation" aria-expanded={navOpen} aria-label="Toggle navigation" onClick={() => setNavOpen(!navOpen)}>
            <span className="navbar-toggler-icon" />
          </button>
          <div className={`collapse navbar-collapse ${navOpen ? 'show' : ''}`} id="mainNavigation">
            <div className="navbar-nav ms-auto align-items-lg-center gap-lg-3">
              <button className={`nav-link ${activeSection === 'home' ? 'active' : ''}`} aria-current={activeSection === 'home' ? 'page' : undefined} type="button" onClick={() => navigateToSection('home')}>Home</button>
              <button className={`nav-link ${activeSection === 'blogs' ? 'active' : ''}`} aria-current={activeSection === 'blogs' ? 'page' : undefined} type="button" onClick={() => navigateToSection('blogs')}>Stories</button>
              <button className={`nav-link ${activeSection === 'contact' ? 'active' : ''}`} aria-current={activeSection === 'contact' ? 'page' : undefined} type="button" onClick={() => navigateToSection('contact')}>Contact</button>
              {page === 'blog' && <button className="btn btn-outline-light btn-sm" onClick={() => navigateToSection('blogs')}>Back to stories</button>}
              {token ? (
                <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Log out</button>
              ) : (
                <button className="btn btn-info text-dark fw-semibold btn-sm" aria-current={activeSection === 'admin' ? 'page' : undefined} type="button" onClick={page === 'login' ? () => navigateToSection('blogs') : openAdmin}>
                  {page === 'login' ? 'Back to stories' : 'Admin'}
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="container py-4 py-lg-5">
        {message && <div className="alert alert-secondary" role="alert">{message}</div>}

        {page === 'home' && (
          <section id="home" className="row align-items-center g-4 g-lg-5 py-4 py-lg-5 mb-4">
            <div className="col-12 col-lg-8">
              <span className="badge rounded-pill text-bg-info mb-3">IDEAS · PEOPLE · EVERYDAY LIFE</span>
              <h1 className="display-4 fw-bold lh-sm mb-3">A fresh perspective,<br className="d-none d-md-block" /> for every day.</h1>
              <p className="lead text-body-secondary mb-4">
                Thoughtful stories on technology, business, and the little things that make life interesting.
              </p>
              <button className="btn btn-dark btn-lg" type="button" onClick={() => navigateToSection('blogs')}>Explore the stories</button>
            </div>
            <div className="col-12 col-lg-4">
              <div className="card border-0 bg-primary-subtle">
                <div className="card-body p-4 p-lg-5">
                  <p className="small text-uppercase fw-semibold text-primary mb-2">A note from the editors</p>
                  <p className="h4 lh-base mb-3">Good ideas grow when we share them.</p>
                  <p className="text-body-secondary mb-0">A place for useful perspectives, fresh thinking, and stories worth passing along.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {page === 'blog' && (
          <section>
            {blogLoading ? <p>Loading blog...</p> : selectedBlog ? (
              <article className="row g-4 align-items-start">
                <div className="col-12 col-md-6">
                  <img className="img-fluid rounded w-100" src={`${API_URL}${selectedBlog.image}`} alt={selectedBlog.title} onError={handleBlogImageError} />
                </div>
                <div className="col-12 col-md-6">
                  <h2 className="h3">{selectedBlog.title}</h2>
                  <div className="d-flex align-items-center gap-2 text-body-secondary small mb-4">
                    <span className="badge rounded-pill text-bg-primary" aria-hidden="true">SE</span>
                    <span><span className="d-block fw-semibold text-body">Softrate Editorial</span>{new Date(selectedBlog.createdAt).toLocaleDateString()}</span>
                  </div>
                  {selectedBlog.content.split(/\n\s*\n/).map((section, index) => {
                    const text = section.trim()
                    if (!text) return null
                    const heading = text.match(/^#{1,3}\s+(.+)$/)
                    if (heading) return <h3 className="h5 mt-4" key={index}>{heading[1]}</h3>
                    return <p key={index}>{text.replace(/\n/g, ' ')}</p>
                  })}
                </div>
              </article>
            ) : !message ? <p>Blog not found.</p> : null}
          </section>
        )}

        {page === 'login' && !token && (
          <section className="col-12 col-md-6 col-lg-4 mx-auto">
            <h2 className="h4 mb-3">Admin login</h2>
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label" htmlFor="email">Email</label>
                <input className="form-control" id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="password">Password</label>
                <input className="form-control" id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <button className="btn btn-dark" type="submit">Log in</button>
            </form>
          </section>
        )}

        {page === 'admin' && token && (
          <section className="mb-5">
            <h2 className="h4 mb-3">Admin dashboard</h2>
            <button className="btn btn-primary mb-3" onClick={() => setShowBlogForm(!showBlogForm)}>
              {showBlogForm ? 'Cancel' : 'Add Blog'}
            </button>
            {showBlogForm && (
              <form className="border rounded p-3 mb-4" onSubmit={handleSaveBlog}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="blog-title">Title</label>
                  <input className="form-control" id="blog-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength="160" required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="blog-image">Image</label>
                  <input className="form-control" id="blog-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} required />
                  {imagePreview && (
                    <div className="ratio ratio-16x9 mt-3">
                      <img className="img-thumbnail object-fit-cover" src={imagePreview} alt="Selected blog preview" />
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="blog-content">Content</label>
                  <textarea className="form-control" id="blog-content" rows="5" value={content} onChange={(event) => setContent(event.target.value)} required />
                </div>
                <button className="btn btn-dark" type="submit">Upload Blog</button>
              </form>
            )}
          </section>
        )}

        {(page === 'home' || (page === 'admin' && token)) && (
          <section id="blogs" className="mb-5">
            <div className="row align-items-end g-3 mb-4">
              <div className="col-12 col-lg-6">
                <p className="small text-uppercase fw-semibold text-primary mb-2">From the journal</p>
                <h2 className="display-6 fw-bold mb-1">Latest stories</h2>
                <p className="text-body-secondary mb-0">Ideas and inspiration for your everyday.</p>
              </div>
              <div className="col-12 col-lg-6">
                <label className="visually-hidden" htmlFor="blog-search">Search stories</label>
                <form className="input-group input-group-lg" onSubmit={(event) => event.preventDefault()}>
                  <input id="blog-search" className="form-control" type="search" placeholder="Search stories..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                  <button className="btn btn-dark" type="submit">Search</button>
                </form>
              </div>
            </div>
            <nav className="nav nav-pills gap-2 mb-4" aria-label="Story categories">
              {categories.map((category) => (
                <button className={`nav-link rounded-pill ${activeCategory === category ? 'active' : 'text-body'}`} type="button" key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>
                  {category}
                </button>
              ))}
            </nav>
            {loading ? <p>Loading blogs...</p> : blogs.length === 0 ? <p>No blogs yet.</p> : (
              filteredBlogs.length === 0 ? <div className="alert alert-light border" role="status">No stories match your search. Try another term or category.</div> : (
                <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                  {filteredBlogs.map((blog) => (
                    <article className="col" key={blog._id}>
                      <div className="card h-100 border-0 shadow-sm position-relative">
                        <a className="stretched-link text-decoration-none text-body" href={`/blog/${blog._id}`} onClick={(event) => openBlog(event, blog._id)}>
                          <div className="ratio ratio-16x9">
                            <img className="card-img-top object-fit-cover" src={`${API_URL}${blog.image}`} alt={blog.title} onError={handleBlogImageError} />
                          </div>
                          <div className="card-body p-4">
                            <span className="badge rounded-pill bg-primary-subtle text-primary mb-3">{getBlogCategory(blog)}</span>
                            <h3 className="h4 card-title mb-2">{blog.title}</h3>
                            <p className="card-text text-body-secondary mb-0">
                              {blog.content.split(/\s+/).slice(0, 24).join(' ')}...
                            </p>
                          </div>
                        </a>
                        <div className="card-footer bg-white border-0 px-4 pb-4 d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge rounded-pill text-bg-primary" aria-hidden="true">SE</span>
                            <span className="small">
                              <span className="d-block fw-semibold">Softrate Editorial</span>
                              <span className="text-body-secondary">{new Date(blog.createdAt).toLocaleDateString()}</span>
                            </span>
                          </div>
                          {page === 'admin' && token && <button className="btn btn-outline-danger btn-sm position-relative z-2" onClick={() => handleDelete(blog._id)}>Delete</button>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {page === 'home' && (
          <section className="border-top pt-5 mt-5">
            <div className="row g-4 align-items-start">
              <div className="col-12 col-lg-5">
                <p className="small text-uppercase fw-semibold text-primary mb-2">Behind the stories</p>
                <h2 className="h2 fw-bold mb-3">About Softrate Technologies</h2>
                <p className="text-body-secondary mb-0">
                  Softrate has been building technology solutions since 2020. The company focuses on creating digital experiences and software solutions that help businesses grow. Its services include website development, mobile applications, e-commerce development, and software solutions.
                </p>
              </div>
              <div className="col-12 col-lg-7">
                <div className="row row-cols-2 row-cols-md-4 g-3">
                  <div className="col"><div className="card h-100 text-center border-0 bg-light"><div className="card-body"><p className="h4 fw-bold mb-1">5+</p><p className="small text-body-secondary mb-0">Years in business</p></div></div></div>
                  <div className="col"><div className="card h-100 text-center border-0 bg-light"><div className="card-body"><p className="h4 fw-bold mb-1">1,000+</p><p className="small text-body-secondary mb-0">Projects delivered</p></div></div></div>
                  <div className="col"><div className="card h-100 text-center border-0 bg-light"><div className="card-body"><p className="h4 fw-bold mb-1">850+</p><p className="small text-body-secondary mb-0">Happy clients</p></div></div></div>
                  <div className="col"><div className="card h-100 text-center border-0 bg-light"><div className="card-body"><p className="h4 fw-bold mb-1">20+</p><p className="small text-body-secondary mb-0">Countries served</p></div></div></div>
                </div>
                <h3 className="h5 fw-semibold mt-4 mb-3">Selected work</h3>
                <div className="list-group list-group-flush">
                  <div className="list-group-item px-0 bg-transparent"><strong>Saravana Stores</strong><span className="text-body-secondary"> — Mobile App Development</span></div>
                  <div className="list-group-item px-0 bg-transparent"><strong>Ampluxe Energy Solutions</strong><span className="text-body-secondary"> — Website Development</span></div>
                  <div className="list-group-item px-0 bg-transparent"><strong>Lime Stone Design Studio</strong><span className="text-body-secondary"> — Digital Presence</span></div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer id="contact" className="bg-dark text-white mt-5">
        <div className="container py-5">
          <div className="row g-4">
            <div className="col-12 col-md-4">
              <h2 className="h5 fw-bold">My Daily Life</h2>
              <p className="text-white-50">Thoughtful reads for curious minds.</p>
              <a className="link-light" href="https://www.softrateglobal.com" target="_blank" rel="noreferrer">
                www.softrateglobal.com
              </a>
            </div>
            <div className="col-12 col-md-4">
              <h2 className="h5">Get in touch</h2>
              <p className="mb-2">Email: <a className="link-light" href="mailto:helpdesk@softrateglobal.com">helpdesk@softrateglobal.com</a></p>
              <p className="mb-2">Phone: <a className="link-light" href="tel:+918148633580">+91 8148633580</a></p>
              <address className="text-white-50 mb-0">Softrate Tech Park, 60A Velleswaram Kovil Street, Mangadu, Chennai – 600122</address>
            </div>
            <div className="col-12 col-md-4">
              <h2 className="h5">Connect</h2>
              <a className="link-light" href="https://www.linkedin.com/company/softrate/" target="_blank" rel="noreferrer">
                Softrate Technologies on LinkedIn
              </a>
            </div>
          </div>
          <hr className="border-secondary my-4" />
          <p className="text-center text-white-50 mb-0">© 2026 My Daily Life. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}

export default App
