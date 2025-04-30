# Port Configuration Consistency Fixes

## Overview

This document summarizes the port configuration changes made to ensure consistency across the application. 

## Port Configuration Standards

- **Backend API Service**: Uses port `3000` internally and externally
- **Frontend Service**: Uses port `3000` internally, but is mapped to `3001` externally in local development

## Changes Made

### Backend Configuration

1. **Backend Dockerfile**
   - Exposes port `3000`
   - Healthcheck configured for `http://localhost:3000/api/health`

2. **Backend Task Definition**
   - Container port set to `3000`
   - Host port set to `3000`
   - Environment variable `PORT` set to `3000`
   - Healthcheck configured for `http://localhost:3000/api/health`

3. **Docker Compose Configuration**
   - Maps port `3000:3000` for backend service 

### Frontend Configuration

1. **Frontend Task Definition**
   - Container port set to `3000`
   - Host port set to `3000`
   - Environment variable `PORT` set to `3000`
   - Healthcheck configured for `http://localhost:3000/health`

2. **Docker Compose Configuration**
   - Maps port `3001:3000` for frontend service 
   - This means frontend is available on port `3001` in local development

### API References

1. **Auth Controller**
   - Updated default frontend URL from `http://localhost:3001` to `http://localhost:3000`
   - This ensures proper redirects after authentication

2. **Notifications API**
   - Updated default API URL from `http://localhost:3001` to `http://localhost:3000`
   - This ensures frontend components properly communicate with the backend API

## Local Development Environment

When running locally with docker-compose:
- Backend API is accessible at: `http://localhost:3000`
- Frontend application is accessible at: `http://localhost:3001`

## Production Environment

When deployed to production:
- Both services use their assigned container ports (3000)
- External access is managed through load balancers and DNS settings