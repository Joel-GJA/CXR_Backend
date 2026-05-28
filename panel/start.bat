@echo off
echo.
echo  CXR Nareen Panel — Phase 3 (All-in-One)
echo  ─────────────────────────────────────────
echo  Single server. No separate host-manager or registry needed.
echo  Registry is started from inside the panel (Host Manager page).
echo.
echo  Optional env vars:
echo    SUPABASE_URL=http://localhost:54321
echo    SUPABASE_SERVICE_ROLE_KEY=your-key
echo    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cxr
echo    CXR_ADMIN_TOKEN=your-secret
echo    CXR_PUBLIC_ADDRESS=192.168.x.x
echo.
echo  Opening: http://localhost:4000
echo.
cd /d "%~dp0server"
node server.js
