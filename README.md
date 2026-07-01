<div align="center">

# 🌋 MANTLE

### Async Media Pipeline

**Heavy work runs beneath the surface.**

Upload images, get an instant response, and watch them process in the background into optimized, multi-size formats — with live status tracking every step of the way.

[**🔗 Live Demo**](https://mantle-eight.vercel.app) &nbsp;·&nbsp; [Report Bug](https://github.com/deekshaasingh/Mantle/issues) &nbsp;·&nbsp; [Request Feature](https://github.com/deekshaasingh/Mantle/issues)

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)

</div>

---

## 📖 Overview

**Mantle** is a full-stack asynchronous media processing pipeline. When a user uploads one or more images, the API doesn't make them wait while the images are resized and compressed — instead it accepts the job, responds **instantly** with a tracking ID, and performs the heavy processing in the background. The user watches each job move through a live status lifecycle and receives cloud-hosted, optimized images in multiple sizes and formats.

The name is the metaphor: like the Earth's mantle, the heavy churning work happens **beneath the surface**, while the API surface the user touches stays cool and fast.

> **The core idea — asynchronous decoupling:** slow, CPU-heavy work is moved off the request/response path. The server returns `202 Accepted` immediately and processes afterward, so API response times stay flat no matter how heavy the load.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| ⚡ **Async processing** | Returns `202 Accepted` instantly; heavy work runs in the background |
| 📡 **Live status tracking** | Frontend polls job status in real time (`processing → done → failed`) |
| 📦 **Batch uploads** | Upload many images at once — each becomes its own concurrent job |
| 🎨 **Format options** | Convert to WebP, JPG, or PNG |
| 🎚️ **Quality control** | Adjustable compression quality (10–100) |
| 🔧 **Transforms** | Grayscale, blur, and rotate — composed into the pipeline |
| 📊 **Compression stats** | Original vs processed size, % saved, and processing time |
| 🖼️ **Multi-size output** | Generates a thumbnail (200px) and desktop (1280px) version |
| 🗂️ **Gallery / history** | Persistent record of all past jobs |
| ☁️ **Cloud delivery** | Processed images stored on Cloudinary and served via CDN |

---

## 🏗️ Architecture

Mantle is a **monorepo** with two independently deployable applications communicating over HTTP.

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│                 │  POST  │                  │        │                 │
│  Next.js UI     │───────▶│  Express API     │───────▶│  MongoDB Atlas  │
│  (Vercel)       │        │  (Render)        │        │  (job records)  │
│                 │◀───────│                  │        │                 │
└─────────────────┘  202   └────────┬─────────┘        └─────────────────┘
     │  polls /status/:id           │
     │                              │ background processing (Sharp)
     │                              ▼
     │                     ┌──────────────────┐
     └────────────────────▶│   Cloudinary     │
        loads CDN images   │  (image storage) │
                           └──────────────────┘
```

### Request lifecycle

1. **Upload** — user selects image(s) + options; frontend POSTs to `/upload`.
2. **Accept & persist** — backend saves a `processing` record and returns `202 Accepted` with a task ID **immediately**.
3. **Background processing** — after responding, the server reads EXIF metadata, applies transforms, resizes into multiple sizes, compresses to the chosen format, and uploads each result to Cloudinary.
4. **Complete** — the record updates to `done` (with CDN URLs, sizes, timing) or `failed` (with an error message).
5. **Live status** — the frontend polls `/status/:id` every 500ms and updates the UI when the job finishes.

---

## 🛠️ Tech Stack

**Frontend**
- [Next.js](https://nextjs.org/) + [React](https://react.dev/) — interactive UI with live status and results gallery

**Backend**
- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) — API server and background processing
- [Sharp](https://sharp.pixelplumbing.com/) — high-performance image resizing, compression, and transforms
- [Multer](https://github.com/expressjs/multer) — multipart file upload handling

**Data & Storage**
- [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) — job persistence with an enum-constrained status (a state machine)
- [Cloudinary](https://cloudinary.com/) — cloud image storage + CDN delivery

**Deployment**
- [Vercel](https://vercel.com/) (frontend) · [Render](https://render.com/) (backend) · [MongoDB Atlas](https://www.mongodb.com/atlas) (database)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- A [MongoDB](https://www.mongodb.com/) database (local or Atlas)
- A [Cloudinary](https://cloudinary.com/) account (free tier)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/deekshaasingh/Mantle.git
cd Mantle
```

**2. Set up the backend**
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:
```env
MONGO_URI=your_mongodb_connection_string
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the backend:
```bash
node server.js
```
> Runs on `http://localhost:4000`

**3. Set up the frontend**

In a new terminal:
```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` folder (optional for local dev — defaults to localhost):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Start the frontend:
```bash
npm run dev
```
> Runs on `http://localhost:3000`

Open [http://localhost:3000](http://localhost:3000) and start uploading.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload an image with `format`, `quality`, and `transforms`. Returns `202` + task ID. |
| `GET` | `/status/:id` | Get the current status and result of a job. |
| `GET` | `/uploads` | List the 20 most recent jobs. |

**Example — upload**
```bash
curl -X POST http://localhost:4000/upload \
  -F "image=@photo.jpg" \
  -F "format=webp" \
  -F "quality=80" \
  -F "transforms=grayscale"
```

**Example — response**
```json
{ "id": "6a4127d2c07f91a28dbfcbf3", "status": "processing" }
```

---

## 🗃️ Data Model

```js
{
  status: "processing" | "done" | "failed",  // enum-constrained state machine
  originalFile: String,
  format: "webp" | "jpg" | "png",
  quality: Number,
  originalSize: Number,        // bytes
  processedSize: Number,       // bytes
  savedPercent: Number,        // compression achieved
  processingMs: Number,        // end-to-end time
  width: Number, height: Number,
  transforms: [String],
  processedFiles: {
    thumbnail: String,         // Cloudinary CDN URL
    desktop:   String          // Cloudinary CDN URL
  },
  error: String | null,
  createdAt: Date
}
```

---

## 🗺️ Roadmap

- [ ] Replace status polling with **WebSocket push** (Socket.IO) for true real-time updates
- [ ] Introduce a **durable job queue** (BullMQ / RabbitMQ) with separate worker processes
- [ ] Add **retry with exponential backoff** and a dead-letter queue for failed jobs
- [ ] **Authentication** and per-user galleries
- [ ] Custom output dimensions and additional transforms (crop, watermark)

---

## 🧠 What This Project Demonstrates

- **Asynchronous decoupling** — moving slow work off the request path to keep APIs responsive
- **Job lifecycle modeling** — a persisted, trackable state machine (`processing → done → failed`)
- **Concurrent job handling** — batch uploads processed in parallel, each tracked independently
- **Production deployment** — decoupled frontend/backend, environment-based config, cloud storage and CDN delivery
- **Real-world debugging** — resolved TLS/network-access issues, ephemeral-storage constraints, and cloud credential/permission errors during deployment

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with 🌋 by [Deeksha Singh](https://github.com/deekshaasingh)

**[⬆ Back to top](#-mantle)**

</div>
