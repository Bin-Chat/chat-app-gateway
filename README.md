# 🌐 Gateway

API Gateway cho Chat Application.

## 📂 Nội dung

- **api-gateway/** - NestJS API Gateway
  - Entry point cho tất cả client requests
  - JWT authentication & authorization
  - Request routing đến microservices
  - CORS, rate limiting, load balancing

## 🚀 Cách chạy

```bash
# Với Docker Compose (recommended)
cd ..
docker-compose up -d api-gateway

# Local development
cd api-gateway
npm install
npm run start:dev
```

## 📚 Tài liệu

Xem [api-gateway/README.md](api-gateway/README.md) để biết chi tiết.
