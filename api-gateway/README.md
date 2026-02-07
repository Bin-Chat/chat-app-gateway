# API Gateway

API Gateway cho Chat App - Routes requests đến các microservices với JWT authentication.

## 🔧 Tech Stack

- **NestJS** - Framework
- **Passport JWT** - Authentication
- **Axios** - HTTP client để forward requests
- **Express** - HTTP server

## 📡 Routes

| Route             | Target Service      | Auth Required | Description              |
| ----------------- | ------------------- | ------------- | ------------------------ |
| `GET /api/health` | Gateway             | ❌            | Health check             |
| `/api/auth/*`     | Auth Service (3010) | ❌            | Authentication endpoints |

**Chưa triển khai:**
- `/api/chat/*` - Chat Service (3001)
- `/api/presence/*` - Presence Service (3002)
- `/api/realtime/*` - Realtime Gateway (3003)
- `/api/media/*` - Media Processor (3004)

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run start:dev
```

API Gateway runs at: http://localhost:3000

### Docker

```bash
# Build
docker build -t api-gateway .

# Run
docker run -p 3000:3000 --env-file .env api-gateway
```

### With Docker Compose

```bash
cd ../../
docker-compose up -d api-gateway
```

## 📋 Environment Variables

| Variable               | Description                            | Example                        |
| ---------------------- | -------------------------------------- | ------------------------------ |
| `PORT`                 | Gateway port                           | `3000`                         |
| `NODE_ENV`             | Environment                            | `development`                  |
| `JWT_SECRET`           | JWT secret (must match Auth Service)   | -                              |
| `AUTH_SERVICE_URL`     | Auth service URL                       | `http://auth-service:3010`     |
| `CHAT_SERVICE_URL`     | Chat service URL                       | `http://chat-service:3001`     |
| `PRESENCE_SERVICE_URL` | Presence service URL                   | `http://presence-service:3002` |
| `REALTIME_SERVICE_URL` | Realtime gateway URL                   | `http://realtime-gateway:3003` |
| `MEDIA_SERVICE_URL`    | Media processor URL                    | `http://media-processor:3004`  |
| `CORS_ORIGIN`          | Allowed CORS origins (comma-separated) | `http://localhost:5173`        |

## 🔐 Authentication Flow

### Public Endpoints (No Auth)

```
Client → API Gateway → Auth Service
```

Example:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0912345678","password":"test123"}'
```

### Protected Endpoints (With Auth)

```
Client (with JWT) → API Gateway (verify JWT) → Target Service
```

Example:

```bash
curl -X GET http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🛡️ Security Features

- ✅ JWT token validation trước khi forward request
- ✅ CORS configuration
- ✅ Request/Response header filtering
- ✅ Service URL mapping
- ✅ Error handling với tiếng Việt
- ✅ Service unavailable detection

## 🔧 How It Works

### 1. Request Flow

```
1. Client gửi request → API Gateway
2. Gateway check route pattern (/api/auth/*, /api/chat/*, etc.)
3. Nếu protected route → Verify JWT token
4. Forward request đến target service
5. Return response từ service về client
```

### 2. JWT Validation

- Extract JWT từ header `Authorization: Bearer <token>`
- Verify token với JWT_SECRET (cùng secret với Auth Service)
- Attach user info (userId, phone) vào request
- Forward request kèm original headers

### 3. Service Discovery

API Gateway sử dụng environment variables để map services:

```typescript
{
  'auth': 'http://auth-service:3010',
  'chat': 'http://chat-service:3001',
  'presence': 'http://presence-service:3002',
  'realtime': 'http://realtime-gateway:3003',
  'media': 'http://media-processor:3004'
}
```

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "ok",
  "service": "API Gateway",
  "timestamp": "2026-02-06T10:00:00.000Z"
}
```

### Auth Routes (Public)

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0912345678","password":"test123"}'
```

### Protected Routes

```bash
# Chat (requires JWT)
curl -X GET http://localhost:3000/api/chat/conversations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Architecture

```
┌──────────────────┐
│  Client (Web/App) │
└────────┬─────────┘
         │ HTTP/HTTPS
         ▼
┌─────────────────────────┐
│   API Gateway :3000     │
│   - Route matching      │
│   - JWT validation      │
│   - Request forwarding  │
└────────┬────────────────┘
         │
    ┌────┴────┬────────┬──────────┬────────┐
    │         │        │          │        │
    ▼         ▼        ▼          ▼        ▼
┌────────┐ ┌────┐ ┌─────────┐ ┌────────┐ ┌─────┐
│ Auth   │ │Chat│ │Presence │ │Realtime│ │Media│
│ :3010  │ │:3001 │:3002   │ │:3003   │ │:3004│
└────────┘ └────┘ └─────────┘ └────────┘ └─────┘
```

## 🔄 Request/Response Examples

### Example 1: Login (No Auth)

**Request:**

```http
POST /api/auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{"phoneNumber":"0912345678","password":"test123"}
```

**Gateway Action:**

- Match route `/api/auth/*` → No auth required
- Forward to `http://auth-service:3010/api/auth/login`

**Response:**

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {...}
}
```

### Example 2: Get Chat Messages (Auth Required)

**Request:**

```http
GET /api/chat/messages?conversationId=123 HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGc...
```

**Gateway Action:**

- Match route `/api/chat/*` → Auth required
- Verify JWT token → Extract userId
- Forward to `http://chat-service:3001/messages?conversationId=123`
- Include Authorization header

**Response:**

```json
{
  "messages": [...]
}
```

## 🛠️ Customization

### Add New Service Route

1. Add service URL to `.env`:

```bash
NEW_SERVICE_URL=http://new-service:3005
```

2. Update `ProxyService` constructor:

```typescript
this.serviceUrls.set('newservice', this.configService.get('NEW_SERVICE_URL'));
```

3. Add route in `ProxyController`:

```typescript
@UseGuards(JwtAuthGuard) // If protected
@All('newservice/*')
async proxyNewService(@Req() req: Request, @Res() res: Response) {
  const path = req.url.replace('/api/newservice', '');
  return this.forwardToService('newservice', path, req, res);
}
```

## 📝 Notes

- **JWT_SECRET phải giống Auth Service** để verify tokens
- Gateway không lưu state, chỉ forward requests
- Tất cả Java services phải expose HTTP endpoints
- WebSocket connections cần special handling (hiện tại chưa support)

## 🚧 Limitations

- ❌ Chưa support WebSocket proxying (cần Socket.io adapter)
- ❌ Chưa có rate limiting
- ❌ Chưa có request caching
- ❌ Chưa có load balancing giữa multiple instances

## 🔮 Future Enhancements

- [ ] WebSocket proxy support
- [ ] Rate limiting per user/IP
- [ ] Request caching (Redis)
- [ ] Circuit breaker pattern
- [ ] Service health monitoring
- [ ] Request/Response logging
- [ ] API analytics
- [ ] Request timeout configuration

## 📄 License

MIT
