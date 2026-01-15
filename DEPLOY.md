# BudgetBud Vercel Deployment Guide

## 🚀 Quick Deploy Checklist

### 1. Vercel Project Setup
- **Framework Preset:** `Next.js`
- **Root Directory:** `budgetbud` (⚠️ **IMPORTANT:** Do NOT leave blank!)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)

### 2. Environment Variables
Add these in Vercel Dashboard > Project Settings > Environment Variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Required for server-side operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. Build & Deploy
1. Push code to GitHub
2. Connect repository in Vercel
3. **Set Root Directory to `budgetbud`** in project settings
4. Deploy!

### 4. Supabase Edge Functions
⚠️ **Deploy separately** - Vercel does not deploy Supabase functions:

```bash
# Deploy each function individually
npx supabase functions deploy verify-pin
npx supabase functions deploy change-pin
npx supabase functions deploy seed-user
```

## 🔧 Configuration Details

### vercel.json (Already Created)
Located in `budgetbud/vercel.json` with:
- Security headers (XSS protection, content-type sniffing, etc.)
- Next.js framework configuration
- Clean URL rewrites

### Environment Variables Reference

**Required for all deployments:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key from Supabase dashboard

**Required for server-side features:**
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)

### Troubleshooting

**❌ Build fails with "Module not found"?**
- ✅ Ensure Root Directory is set to `budgetbud`
- ✅ Check that all dependencies are in `budgetbud/package.json`

**❌ Authentication not working?**
- ✅ Verify environment variables are set correctly
- ✅ Ensure Supabase project allows your Vercel domain

**❌ Edge Functions not working?**
- ✅ Remember to deploy them separately via Supabase CLI
- ✅ Functions are NOT deployed by Vercel

### 📋 Post-Deploy Checklist

- [ ] App loads correctly at deployed URL
- [ ] Authentication works (login/register)
- [ ] Dashboard shows data
- [ ] PIN change functionality works
- [ ] All navigation works properly
- [ ] Mobile layout looks good

### 🎯 Production URL
After successful deployment, your BudgetBud instance will be live at:
`https://your-project.vercel.app`

---

**Need help?** Check Vercel deployment logs or Supabase function logs for detailed error messages.
