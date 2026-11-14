const dns=require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const Admin = require('./models/Admin');
const Blog = require('./models/Blog');

dotenv.config();


const app = express();
const port = process.env.PORT || 5000;
const uploadsDirectory = path.join(__dirname, 'uploads');
const imageTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

fs.mkdirSync(uploadsDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDirectory),
    filename: (_req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${imageTypes[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!imageTypes[file.mimetype]) {
      return callback(new Error('Choose a JPG, PNG, or WebP image.'));
    }
    callback(null, true);
  },
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDirectory));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/admin/login', requireDatabase, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'JWT_SECRET is not set in server/.env.' });
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const admin = await Admin.findOne({ email: normalizedEmail });
    const passwordMatches = admin && typeof password === 'string'
      ? await bcrypt.compare(password, admin.passwordHash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { adminId: admin._id.toString(), role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    );
    res.json({ token });
  } catch (error) {
    next(error);
  }
});

function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ message: 'Admin login is required.' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin permission is required.' });
    }
    next();
  } catch {
    res.status(401).json({ message: 'Admin login has expired. Please log in again.' });
  }
}

function requireDatabase(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB is not connected. Check MONGODB_URI in server/.env.' });
  }
  next();
}

async function removeImage(imagePath) {
  if (!imagePath) return;
  try {
    await fs.promises.unlink(path.join(uploadsDirectory, path.basename(imagePath)));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not remove uploaded image:', error.message);
  }
}

app.get('/api/blogs', requireDatabase, async (_req, res, next) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    next(error);
  }
});

app.get('/api/blogs/:id', requireDatabase, async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found.' });
    res.json(blog);
  } catch (error) {
    next(error);
  }
});

app.post('/api/blogs', requireAdmin, requireDatabase, upload.single('image'), async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim() || !req.file) {
      await removeImage(req.file?.filename);
      return res.status(400).json({ message: 'Title, image, and content are required.' });
    }

    const blog = await Blog.create({
      title: title.trim(),
      image: `/uploads/${req.file.filename}`,
      content: content.trim(),
    });
    res.status(201).json(blog);
  } catch (error) {
    await removeImage(req.file?.filename);
    next(error);
  }
});

app.delete('/api/blogs/:id', requireAdmin, requireDatabase, async (req, res, next) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found.' });
    await removeImage(blog.image);
    res.json({ message: 'Blog deleted.' });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be 5 MB or smaller.'
      : 'The image upload could not be processed.';
    return res.status(400).json({ message });
  }
  if (error.message === 'Choose a JPG, PNG, or WebP image.') {
    return res.status(400).json({ message: error.message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Blog details are invalid.' });
  }
  console.error(error);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

async function startServer() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    await createInitialAdmin();
  } else {
    console.warn('MONGODB_URI is not set; blog APIs are unavailable');
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

async function createInitialAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env.');
  }

  const existingAdmin = await Admin.findOne({ email });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(password, 10);
    await Admin.create({ email, passwordHash });
    console.log(`Created initial admin account for ${email}`);
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});