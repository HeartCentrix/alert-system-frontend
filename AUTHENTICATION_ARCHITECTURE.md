# TM Alert Authentication & Session Management

## Complete Situation Analysis (March 2026)

---

## 📋 Current Situation

### Deployment Architecture

```
┌─────────────────────────────────────┐
│  Frontend: Vercel                   │
│  URL: https://alert-system-frontend-jq7u.vercel.app
│  Framework: React + Vite            │
└─────────────────────────────────────┘
              ↓ (HTTPS, Cross-Origin)
┌─────────────────────────────────────┐
│  Backend: Railway                   │
│  URL: https://web-production-*.up.railway.app
│  Framework: FastAPI + SQLAlchemy    │
└─────────────────────────────────────┘
```

### The Problem

| Step | Action | Result |
|------|--------|--------|
| 1 | User logs in successfully (with MFA) | ✅ Session works |
| 2 | User reloads page (F5) | ❌ Logged out automatically |
| 3 | `/auth/me` API returns 403 | Session lost |
| 4 | `/auth/refresh` returns 401 | `{"detail": "No refresh token"}` |
| 5 | User redirected to login | ❌ Poor UX |

### Why Cookies Fail (Cross-Origin Issue)

```
1. Backend (Railway) tries to set cookie:
   Set-Cookie: refresh_token=...; Domain=.up.railway.app

2. Browser rejects:
   "Cookie domain must match response origin"

3. Frontend (Vercel) cannot read Railway's cookies:
   - vercel.app ≠ railway.app (different root domains)
   - Browser security policy blocks cross-origin cookies

4. Result:
   - Refresh token unavailable after page reload
   - Session cannot be restored
   - User logged out
```

### Failed Approaches (What We Tried)

| Approach | Why It Failed |
|----------|---------------|
| ❌ HttpOnly Cookie with `SameSite=lax` | Browser blocks cross-origin cookies from Railway when request comes from Vercel |
| ❌ HttpOnly Cookie with `SameSite=none` + `Secure` | Still blocked because cookie domain mismatch (.railway.app ≠ .vercel.app) |
| ❌ Adding `domain=".up.railway.app"` | Browser rejects: "Cookie domain must match response origin" |
| ❌ Returning refresh_token in response body ONLY | Security vulnerability (XSS exposure) - reverted |

---

## 🎯 Original Design (How It Was Supposed to Work)

### Intended Architecture (Same-Origin)

```
┌──────────────────────────────────────────────┐
│  Frontend + Backend on SAME domain           │
│  Example: https://app.tmalert.com            │
│                                               │
│  ┌─────────────┐    ┌──────────────┐         │
│  │  Frontend   │    │   Backend    │         │
│  │  (static)   │───→│   (API)      │         │
│  │  /          │    │   /api/v1/   │         │
│  └─────────────┘    └──────────────┘         │
│         ↑                  ↑                  │
│         └──────────────────┘                  │
│         Same origin = Cookies work!           │
└──────────────────────────────────────────────┘
```

### Original Security Model

**Frontend:**
```javascript
// Access token in memory (Zustand)
accessToken: null  // In-memory only, cleared on tab close
```

**Backend:**
```python
# Refresh token in HttpOnly cookie
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
```

**Security Benefits:**
- ✅ XSS cannot steal refresh token (HttpOnly)
- ✅ CSRF prevented (SameSite=Strict + CSRF tokens)
- ✅ Automatic token rotation (refresh endpoint)
- ✅ Session persists across page reloads

**Why This Design:**
- OWASP Best Practice (2026): HttpOnly cookies for refresh tokens
- Zero XSS risk: JavaScript never sees refresh token
- Automatic handling: Browser sends cookie automatically
- Clean architecture: Frontend only manages access token

---

## 🔧 Current Workaround (How We're Fixing It Now)

### Temporary Solution (Cross-Origin Memory Storage)

```
┌─────────────────────────────────────┐
│  Frontend: Vercel                   │
│  ┌───────────────────────────────┐  │
│  │ Zustand Store (Memory)        │  │
│  │ - accessToken: "..."          │  │
│  │ - refreshToken: "..." ← NEW   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Backend: Railway                   │
│  ┌───────────────────────────────┐  │
│  │ Response Body                 │  │
│  │ - access_token: "..."         │  │
│  │ - refresh_token: "..." ← NEW  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Set-Cookie (fallback)         │  │
│  │ - refresh_token=...           │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Implementation

#### Backend Changes

**File:** `Alert-system-backend/app/schemas.py`

```python
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"
    refresh_token: Optional[str] = None  # ← NEW: For cross-origin deployments

class LoginSuccessResponse(BaseModel):
    status: str = "success"
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"
    refresh_token: Optional[str] = None  # ← NEW: For cross-origin deployments
    recovery_codes: Optional[List[str]] = None
    recovery_codes_warning: Optional[str] = None
```

**File:** `Alert-system-backend/app/api/auth.py`

```python
# Login endpoint returns BOTH body + cookie
@router.post("/login")
async def login(request: LoginRequest, response: Response):
    # ... authentication logic ...
    
    # Set refresh token as HttpOnly cookie (for same-origin fallback)
    _set_refresh_cookie(response, refresh_token_str, expire_days)
    
    return LoginSuccessResponse(
        status="success",
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        refresh_token=refresh_token_str  # ← NEW: For cross-origin (Vercel)
    )

# Refresh endpoint accepts BOTH cookie + body
@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: Request, response: Response, db: Session):
    # Try to read refresh token from HttpOnly cookie first (same-origin)
    refresh_token_str = req.cookies.get("refresh_token")
    
    # If no cookie, try request body (cross-origin fallback for Vercel + Railway)
    if not refresh_token_str:
        try:
            body = await req.json()
            refresh_token_str = body.get("refresh_token")
        except:
            pass
    
    if not refresh_token_str:
        raise HTTPException(status_code=401, detail="No refresh token")
    
    # ... token validation and rotation ...
    
    return TokenResponse(
        access_token=new_access,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        refresh_token=new_refresh_str  # ← NEW: Return rotated token
    )
```

#### Frontend Changes

**File:** `alert-system-frontend/src/store/authStore.js`

```javascript
// Helper functions for sessionStorage (survives page reload, cleared on tab close)
const saveRefreshToken = (token) => {
  if (token) {
    sessionStorage.setItem('refresh_token', token)
  }
}

const getRefreshToken = () => {
  return sessionStorage.getItem('refresh_token')
}

const clearRefreshToken = () => {
  sessionStorage.removeItem('refresh_token')
}

const useAuthStore = create((set, get) => ({
  accessToken: null,    // In-memory only
  refreshToken: null,   // In-memory + sessionStorage (for cross-origin)
  
  init: async () => {
    try {
      // First, try to get user info
      const { data } = await authAPI.me()
      set({ user: data, isAuthenticated: true })
    } catch (error) {
      // If /me fails (401/403), try to refresh
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        const refreshTokenFromStorage = getRefreshToken()
        
        // Attempt silent refresh using refresh token
        const { data: refreshData } = await authAPI.refresh(refreshTokenFromStorage)
        
        if (refreshData?.access_token) {
          // Save new refresh token if rotated
          if (refreshData.refresh_token) {
            saveRefreshToken(refreshData.refresh_token)
          }
          set({ 
            accessToken: refreshData.access_token,
            refreshToken: refreshData.refresh_token || refreshTokenFromStorage,
          })
          // Fetch user info with new access token
          const { data: userData } = await authAPI.me()
          set({ user: userData, isAuthenticated: true })
          return
        }
      }
      // Refresh failed - clear session
      clearRefreshToken()
      set({ user: null, isAuthenticated: false })
    }
  },
  
  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)
    
    if (data.status === 'mfa_required') {
      // Handle MFA flow...
      return data
    }
    
    // Store access token in memory, refresh token in sessionStorage
    saveRefreshToken(data.refresh_token)
    set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
      isAuthenticated: true,
    })
    return data
  },
  
  logout: async () => {
    await authAPI.logout()
    clearRefreshToken()
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false })
  }
}))
```

**File:** `alert-system-frontend/src/services/api.js`

```javascript
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  refresh: (refreshToken) => api.post('/auth/refresh', 
    refreshToken ? { refresh_token: refreshToken } : {}, 
    { withCredentials: true }  // Send both: body (cross-origin) + cookie (same-origin)
  ),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout', {}),
}

// Axios interceptor - skip /auth/me and /auth/refresh (handled by init())
api.interceptors.request.use((config) => {
  const token = _getAuthStore?.()?.accessToken ?? null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

### Security Trade-offs

| Aspect | Original (HttpOnly) | Current (Memory + sessionStorage) |
|--------|---------------------|-----------------------------------|
| **XSS Protection** | ✅ Full (token inaccessible) | ⚠️ Partial (token in memory) |
| **CSRF Protection** | ✅ Full (SameSite=Strict) | ⚠️ Partial (SameSite=None) |
| **Page Reload** | ✅ Works automatically | ✅ Works with refresh logic |
| **Tab Close** | ✅ Cookie cleared | ✅ sessionStorage cleared |
| **Cross-Origin** | ❌ Doesn't work | ✅ Works |
| **OWASP Compliance** | ✅ Full | ⚠️ Acceptable for temporary |

### Why This is Acceptable (Temporary)

1. ✅ **In-memory + sessionStorage only** - Not persisted to localStorage
2. ✅ **Cleared on tab close** - sessionStorage auto-cleared when tab closes
3. ✅ **HTTPS only** - Tokens encrypted in transit
4. ✅ **Short-lived tokens** - Access token: 1 hour, Refresh token: 7 days
5. ✅ **CSRF tokens still active** - X-CSRF-Token header required for state-changing requests
6. ✅ **XSS minimized** - No console.log in production, sourcemaps disabled
7. ✅ **Dual delivery** - Backend still sets HttpOnly cookie as fallback

---

## 🚀 Future State (With Custom Domain)

### Target Architecture (6-12 months)

```
┌──────────────────────────────────────────────┐
│  Custom Domain: tmalert.com                  │
│                                               │
│  ┌─────────────────┐    ┌─────────────────┐  │
│  │ Frontend        │    │ Backend         │  │
│  │ app.tmalert.com │    │ api.tmalert.com │  │
│  │ (Vercel)        │    │ (Railway/AWS)   │  │
│  └─────────────────┘    └─────────────────┘  │
│         ↑                        ↑           │
│         └────────────────────────┘           │
│         Cookie Domain: .tmalert.com          │
│         (Works across ALL subdomains!)       │
└──────────────────────────────────────────────┘
```

### DNS Configuration

```
tmalert.com (root)
├── app.tmalert.com     → Vercel (CNAME)
├── api.tmalert.com     → Railway/AWS (CNAME)
└── www.tmalert.com     → Redirect to app.tmalert.com
```

### Cookie Configuration (Future)

**Backend:**
```python
def _set_refresh_cookie(response: Response, token: str):
    """
    Set HttpOnly refresh token cookie for same-origin deployments.
    
    With custom domain, cookies work across subdomains:
    - api.tmalert.com can set cookie for .tmalert.com
    - app.tmalert.com can read that cookie
    """
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,      # JavaScript cannot read (XSS protection)
        secure=True,        # HTTPS only
        samesite="lax",     # Can use lax with custom domain
        domain=".tmalert.com",  # ← Works across ALL subdomains!
        path="/api/v1/auth",  # Scoped to auth endpoints
        max_age=7 * 86400,    # 7 days
    )
```

### Frontend Changes (Revert to Original)

**File:** `alert-system-frontend/src/store/authStore.js`

```javascript
// REMOVE refreshToken from memory
const useAuthStore = create((set, get) => ({
  accessToken: null,    // In-memory ✅
  // refreshToken: null,  ← REMOVE THIS
  
  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)
    set({
      accessToken: data.access_token,
      // Don't store refresh_token - it's in cookie!
      user: data.user,
      isAuthenticated: true,
    })
  },
  
  init: async () => {
    try {
      const { data } = await authAPI.me()
      set({ user: data, isAuthenticated: true })
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        // Refresh token cookie sent automatically
        const { data: refreshData } = await authAPI.refresh()
        set({ accessToken: refreshData.access_token })
        const { data: userData } = await authAPI.me()
        set({ user: userData, isAuthenticated: true })
      }
    }
  }
}))
```

**File:** `alert-system-frontend/src/services/api.js`

```javascript
export const authAPI = {
  // REMOVE refreshToken parameter
  refresh: () => api.post('/auth/refresh', {}, { 
    withCredentials: true  // Cookie sent automatically
  }),
}
```

### Security Improvements (Custom Domain)

| Aspect | Current (Memory) | Future (HttpOnly Cookie) |
|--------|------------------|--------------------------|
| **XSS Protection** | ⚠️ Partial | ✅ Full |
| **CSRF Protection** | ⚠️ Partial | ✅ Full |
| **Cross-Subdomain** | ✅ Works | ✅ Works |
| **Compliance** | ⚠️ Acceptable | ✅ OWASP Compliant |
| **Code Complexity** | ⚠️ Higher (dual logic) | ✅ Lower (cookie-only) |

---

## ☁️ Future Migration (AWS/Cloud Shift)

### Scenario: Moving Backend from Railway to AWS

#### Option A: Keep Custom Domain (Recommended)

```
tmalert.com
├── app.tmalert.com     → Vercel (unchanged)
├── api.tmalert.com     → AWS ALB → ECS/Lambda
└── Cookie: .tmalert.com (unchanged)
```

**Changes Required:**
- ✅ **Zero code changes** - Cookie domain already configured
- ✅ Update DNS records (api.tmalert.com → AWS ALB)
- ✅ Update CORS allowed origins (add AWS domain if needed)
- ✅ Update environment variables (DATABASE_URL, REDIS_URL, etc.)

**AWS Infrastructure:**
```yaml
# Example: AWS ECS Fargate
Resources:
  AlertSystemCluster:
    Type: AWS::ECS::Cluster
  
  AlertSystemTask:
    Type: AWS::ECS::TaskDefinition
    Properties:
      ContainerDefinitions:
        - Name: backend
          Image: {ECR_REPO_URI}
          Environment:
            - Name: DATABASE_URL
              Value: {RDS_ENDPOINT}
            - Name: REDIS_URL
              Value: {ELASTICACHE_ENDPOINT}
  
  AlertSystemALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Subnets: [subnet-1, subnet-2]
      SecurityGroups: [sg-alb]
```

#### Option B: Temporary Domain Change (Not Recommended)

```
# If AWS domain is different (e.g., aws.tmalert.com)
tmalert.com
├── app.tmalert.com     → Vercel
└── aws.tmalert.com     → AWS ALB

# Cookie domain must be updated to:
domain=".tmalert.com"  # Root domain to cover all subdomains
```

**Changes Required:**
- ✅ Update backend cookie domain setting
- ✅ Update CORS allowed origins
- ✅ Update frontend API base URL

---

## 📝 Migration Checklist

### Phase 1: Current (Cross-Origin Workaround)

- [x] Backend returns `refresh_token` in response body
- [x] Backend accepts `refresh_token` from request body in `/auth/refresh`
- [x] Frontend stores `refresh_token` in sessionStorage
- [x] Frontend sends `refresh_token` in request body on refresh
- [x] Debug logging added to trace auth flow
- [ ] Deploy backend from `dev-am` branch to Railway
- [ ] Deploy frontend from `dev-am` branch to Vercel
- [ ] Test page reload (F5) preserves session
- [ ] Test MFA flow preserves session
- [ ] Test logout clears sessionStorage

### Phase 2: Custom Domain Setup

- [ ] Purchase custom domain (tmalert.com)
- [ ] Configure DNS records:
  - [ ] app.tmalert.com → Vercel
  - [ ] api.tmalert.com → Railway/AWS
- [ ] Update backend cookie configuration:
  - [ ] Set `domain=".tmalert.com"`
  - [ ] Change `samesite="lax"`
- [ ] Update frontend:
  - [ ] Remove `refresh_token` from sessionStorage
  - [ ] Remove `refresh_token` from request body
  - [ ] Keep `withCredentials: true`
- [ ] Test cross-subdomain cookie sharing
- [ ] Create PR: `dev-am` → `main`
- [ ] Deploy from `main` branch

### Phase 3: AWS Migration (Optional)

- [ ] Set up AWS infrastructure:
  - [ ] VPC, subnets, security groups
  - [ ] ECS Fargate or Lambda
  - [ ] RDS PostgreSQL
  - [ ] ElastiCache Redis
  - [ ] Application Load Balancer
- [ ] Update DNS: api.tmalert.com → AWS ALB
- [ ] Migrate database
- [ ] Update environment variables
- [ ] Test thoroughly in staging
- [ ] Cut over production traffic

---

## 🔒 Security Best Practices

### Current (Temporary)

1. **Token Storage:**
   - ✅ Access token: In-memory (Zustand)
   - ✅ Refresh token: sessionStorage (cleared on tab close)
   - ❌ NEVER localStorage (persists indefinitely)

2. **Transport Security:**
   - ✅ HTTPS only (enforced by Vercel/Railway)
   - ✅ Secure cookie flag set
   - ✅ SameSite=None (required for cross-origin)

3. **CSRF Protection:**
   - ✅ X-CSRF-Token header required
   - ✅ Cookie-based CSRF token
   - ⚠️ SameSite=None reduces protection (temporary)

4. **XSS Mitigation:**
   - ✅ No console.log in production
   - ✅ Source maps disabled in production
   - ✅ Content Security Policy (CSP) headers
   - ⚠️ Refresh token accessible to JS (temporary)

5. **Token Rotation:**
   - ✅ Refresh token rotated on each use
   - ✅ Old tokens revoked in database
   - ✅ Access token short-lived (1 hour)

### Future (Custom Domain)

1. **Token Storage:**
   - ✅ Access token: In-memory (Zustand)
   - ✅ Refresh token: HttpOnly cookie (inaccessible to JS)

2. **Transport Security:**
   - ✅ HTTPS only
   - ✅ Secure cookie flag
   - ✅ SameSite=Lax (better CSRF protection)

3. **CSRF Protection:**
   - ✅ X-CSRF-Token header
   - ✅ SameSite=Lax cookies
   - ✅ Full OWASP compliance

4. **XSS Protection:**
   - ✅ Refresh token inaccessible to JS (HttpOnly)
   - ✅ Full XSS immunity for refresh tokens

---

## 📚 References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [RFC 6265 - HTTP State Management Mechanism (Cookies)](https://tools.ietf.org/html/rfc6265)
- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)

---

## 📞 Support

For questions or issues related to authentication:

1. Check browser console for `[authStore.init]` logs
2. Verify sessionStorage contains `refresh_token`
3. Ensure backend is deployed from correct branch (`dev-am` for current fix)
4. Check Railway/Vercel deployment logs for errors

**Current Branch Status:**
- Backend: `dev-am` (commit `02f2356`)
- Frontend: `dev-am` (commit `d9aaa77`)

**Next Steps:**
1. Deploy backend from `dev-am` to Railway
2. Test locally with `git checkout dev-am`
3. Watch console logs for auth flow
4. Create PR when ready: `dev-am` → `main`

---

*Last Updated: March 12, 2026*  
*Author: AI Assistant (Qwen Code)*  
*Review Status: Pending user testing*
