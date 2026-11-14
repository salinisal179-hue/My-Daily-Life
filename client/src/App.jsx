import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getBlogIdFromPath() {
  return window.location.pathname.match(/^\/blog\/([^/]+)\/?$/)?.[1] || ''
}

function App() {
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)
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
      <header className="container py-4 border-bottom">
        <div className="d-flex justify-content-end mb-3">
          {page === 'blog' ? (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => navigateToSection('blogs')}>
              Back to Blogs
            </button>
          ) : token ? (
            <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
              Log out
            </button>
          ) : page === 'login' ? (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setPage('home')}>
              Back to blogs
            </button>
          ) : null}
        </div>
        <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom" aria-label="Main navigation">
          <a className="navbar-brand fs-4 fw-semibold" href="/" onClick={(event) => { event.preventDefault(); navigateToSection('home') }}>
            My Daily Life
          </a>
          <button className="navbar-toggler" type="button" aria-controls="mainNavigation" aria-expanded={navOpen} aria-label="Toggle navigation" onClick={() => setNavOpen(!navOpen)}>
            <span className="navbar-toggler-icon" />
          </button>
          <div className={`collapse navbar-collapse ${navOpen ? 'show' : ''}`} id="mainNavigation">
            <div className="navbar-nav ms-auto align-items-lg-center gap-lg-3">
              <button className={`nav-link px-2 border-bottom border-2 ${activeSection === 'home' ? 'active border-primary' : 'border-white'}`} aria-current={activeSection === 'home' ? 'page' : undefined} type="button" onClick={() => navigateToSection('home')}>Home</button>
              <button className={`nav-link px-2 border-bottom border-2 ${activeSection === 'blogs' ? 'active border-primary' : 'border-white'}`} aria-current={activeSection === 'blogs' ? 'page' : undefined} type="button" onClick={() => navigateToSection('blogs')}>Blogs</button>
              <button className={`nav-link px-2 border-bottom border-2 ${activeSection === 'contact' ? 'active border-primary' : 'border-white'}`} aria-current={activeSection === 'contact' ? 'page' : undefined} type="button" onClick={() => navigateToSection('contact')}>Contact Us</button>
              <button className="btn btn-primary text-white px-3 ms-lg-2" aria-current={activeSection === 'admin' ? 'page' : undefined} type="button" onClick={openAdmin}>Admin</button>
            </div>
          </div>
        </nav>
      </header>

      <main className="container py-4">
        {message && <div className="alert alert-secondary" role="alert">{message}</div>}

        {page === 'home' && (
          <section id="home" className="mb-5">
            <h2 className="h3 text-center mb-3">About Softrate Technologies</h2>
            <p className="mb-0">
              Softrate has been building technology solutions since 2020. The company focuses on creating digital experiences and software solutions that help businesses grow. Its services include website development, mobile applications, e-commerce development, and software solutions.
            </p>

            <h3 className="h5 mt-4 mb-3">Company Achievements</h3>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
              <div className="col"><div className="card h-100 text-center"><div className="card-body"><p className="h4 mb-1">5+ Years</p><p className="mb-0">In Business</p></div></div></div>
              <div className="col"><div className="card h-100 text-center"><div className="card-body"><p className="h4 mb-1">1,000+</p><p className="mb-0">Projects Delivered</p></div></div></div>
              <div className="col"><div className="card h-100 text-center"><div className="card-body"><p className="h4 mb-1">850+</p><p className="mb-0">Happy Clients</p></div></div></div>
              <div className="col"><div className="card h-100 text-center"><div className="card-body"><p className="h4 mb-1">20+</p><p className="mb-0">Countries Served</p></div></div></div>
            </div>

            <h3 className="h5 mt-4 mb-3">Our Work</h3>
            <div className="row g-3">
              <div className="col-12 col-md-4"><p className="mb-0"><strong>Saravana Stores</strong> – Mobile App Development</p></div>
              <div className="col-12 col-md-4"><p className="mb-0"><strong>Ampluxe Energy Solutions</strong> – Website Development</p></div>
              <div className="col-12 col-md-4"><p className="mb-0"><strong>Lime Stone Design Studio</strong> – Digital Presence</p></div>
            </div>
          </section>
        )}

        {page === 'blog' && (
          <section>
            {blogLoading ? <p>Loading blog...</p> : selectedBlog ? (
              <article className="row g-4 align-items-start">
                <div className="col-12 col-md-6">
                  <img className="img-fluid rounded w-100" src={`${API_URL}${selectedBlog.image}`} alt={selectedBlog.title} />
                </div>
                <div className="col-12 col-md-6">
                  <h2 className="h3">{selectedBlog.title}</h2>
                  {selectedBlog.content.split(/\n\s*\n/).map((section, index) => {
                    const text = section.trim()
                    if (!text) return null
                    const heading = text.match(/^#{1,3}\s+(.+)$/)
                    if (heading) return <h3 className="h5 mt-4" key={index}>{heading[1]}</h3>
                    return <p key={index}>{text.replace(/\n/g, ' ')}</p>
                  })}
                  <p className="text-body-secondary mb-0">{new Date(selectedBlog.createdAt).toLocaleDateString()}</p>
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
          <section id="blogs">
            <h2 className="h4 mb-4">Blogs</h2>
            {loading ? <p>Loading blogs...</p> : blogs.length === 0 ? <p>No blogs yet.</p> : (
              <div className="row g-4">
                {blogs.map((blog) => (
                  <article className="col-12 col-md-6 col-lg-4" key={blog._id}>
                    <div className="card h-100 position-relative">
                      <a className="stretched-link text-decoration-none text-body" href={`/blog/${blog._id}`} onClick={(event) => openBlog(event, blog._id)}>
                        <div className="ratio ratio-16x9">
                          <img className="card-img-top object-fit-cover" src={`${API_URL}${blog.image}`} alt={blog.title} />
                        </div>
                        <div className="card-body">
                          <h3 className="h5 card-title mb-0">{blog.title}</h3>
                          <p className="card-text mt-2 mb-0">
                            {blog.content.split(/\s+/).slice(0, 24).join(' ')}...
                          </p>
                        </div>
                      </a>
                      <div className="card-footer bg-white d-flex justify-content-between align-items-center">
                        <small className="text-body-secondary">{new Date(blog.createdAt).toLocaleDateString()}</small>
                        {page === 'admin' && token && <button className="btn btn-outline-danger btn-sm position-relative z-2" onClick={() => handleDelete(blog._id)}>Delete</button>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer id="contact" className="bg-light border-top mt-5">
        <div className="container py-4">
          <div className="row g-4">
            <div className="col-12 col-md-4">
              <h2 className="h5">Softrate Technologies</h2>
              <a className="link-dark" href="https://www.softrateglobal.com" target="_blank" rel="noreferrer">
                www.softrateglobal.com
              </a>
            </div>
            <div className="col-12 col-md-4">
              <h2 className="h5">Contact Us</h2>
              <p className="mb-2">Email: <a className="link-dark" href="mailto:helpdesk@softrateglobal.com">helpdesk@softrateglobal.com</a></p>
              <p className="mb-2">Phone: <a className="link-dark" href="tel:+918148633580">+91 8148633580</a></p>
              <address className="mb-0">Softrate Tech Park, 60A Velleswaram Kovil Street, Mangadu, Chennai – 600122</address>
            </div>
            <div className="col-12 col-md-4">
              <h2 className="h5">Connect</h2>
              <a className="link-dark" href="https://www.linkedin.com/company/softrate/" target="_blank" rel="noreferrer">
                Softrate Technologies on LinkedIn
              </a>
            </div>
          </div>
          <hr />
          <p className="text-center mb-0">© 2026 All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}

export default App
