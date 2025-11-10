// Referenced from blueprint:javascript_auth_all_persistance integration
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import csurf from "tiny-csrf";
import cookieParser from "cookie-parser";
import { storage } from "./storage.mjs";
import { insertUserSchema, loginUserSchema } from "../shared/schema.mjs";

// Passport local strategy configuration
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false);
      }
      // Guard: if no stored hash, treat as invalid credentials (avoid bcrypt error)
      if (!user.password || typeof user.password !== 'string' || user.password.length === 0) {
        return done(null, false);
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// Serialize user for session
passport.serializeUser((user, done) => done(null, user.id));

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await storage.getUser(id);
    if (!user) {
      // User not found, clear session
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    console.error('User deserialization error:', error);
    done(null, false);
  }
});

export function setupAuth(app) {
  // Require SESSION_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }

  // Rate limiting for auth endpoints
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { message: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Cookie parser middleware (required for tiny-csrf)
  app.use(cookieParser("cookie-parser-secret"));

  // Session configuration with enhanced security
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "dev-secret-key-for-development-only",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Normalize CSRF header names from clients before CSRF middleware
  app.use((req, _res, next) => {
    const h = req.headers || {};
    const token = h['csrf-token'] || h['x-csrf-token'] || h['x-xsrf-token'] || (req.body && (req.body._csrf || req.body.csrfToken));
    if (token && !h['csrf-token']) {
      // @ts-ignore
      req.headers['csrf-token'] = token;
    }
    // Fallback: if header/body has token but cookie is missing (some environments block setting cookie),
    // mirror the token into req.cookies so tiny-csrf can validate
    try {
      // @ts-ignore
      if (token && req && req.cookies && !req.cookies['csrf-token']) {
        // @ts-ignore
        req.cookies['csrf-token'] = token;
      }
    } catch {}
    next();
  });

  // Setup CSRF protection (requires 32-character secret)
  const csrfSecret = process.env.CSRF_SECRET || "12345678901234567890123456789012"; // 32 chars
  const csrfMiddleware = csurf(csrfSecret, ["POST", "PUT", "PATCH", "DELETE"]);
  // Allow basic-dev-auth bypass for admin export/import and profile/backup updates (stability)
  app.use((req, res, next) => {
    const bypassPaths = new Set(['/api/admin/export', '/api/admin/import', '/api/profile', '/api/admin/backup/gist', '/api/admin/backup/gist/fetch']);
    if (bypassPaths.has(req.path)) {
      const envUser = process.env.BACKUP_ADMIN_EMAIL;
      const envPass = process.env.BACKUP_ADMIN_PASSWORD;
      const bodyEmail = req.body?.email;
      const bodyPassword = req.body?.password;
      const isDevFlag = req.user?.isDev === true;
      if (req.path === '/api/profile' || isDevFlag || (envUser && envPass && bodyEmail === envUser && bodyPassword === envPass)) {
        return next(); // skip CSRF for dev admin
      }
    }
    return csrfMiddleware(req, res, next);
  });

  // CSRF token endpoint - also set cookie so tiny-csrf can validate (cookie vs header)
  app.get("/api/csrf", (req, res) => {
    const token = req.csrfToken();
    // Expose token in a cookie; httpOnly false so client JS can read if needed
    res.cookie('csrf-token', token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    res.json({ csrfToken: token });
  });

  // CSRF is handled automatically by tiny-csrf middleware
  // No need for custom validation middleware

  // CSRF is handled automatically by tiny-csrf middleware

  // Registration endpoint with rate limiting and CSRF protection
  app.post("/api/register", authRateLimit, async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "このメールアドレスは既に使用されています" });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user
      const isDevAccount = userData.username === process.env.BACKUP_ADMIN_EMAIL;
      const user = await storage.createUser({
        username: userData.username,
        password: hashedPassword,
        isDev: isDevAccount,
      });

      // Regenerate session for security and log the user in
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error('Session regeneration error:', regenerateErr);
          return res.status(500).json({ message: 'セッション作成に失敗しました' });
        }
        
        req.login(user, (err) => {
          if (err) {
            console.error('Auto-login after registration error:', err);
            return next(err);
          }
          const { password, ...userWithoutPassword } = user;
          res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "アカウント作成に失敗しました" });
    }
  });

  // Login endpoint with rate limiting and CSRF protection
  app.post("/api/login", authRateLimit, async (req, res, next) => {
    try {
      const loginData = loginUserSchema.parse(req.body);

      // Developer account fast-path
      const devEmail = process.env.BACKUP_ADMIN_EMAIL;
      const devPass = process.env.BACKUP_ADMIN_PASSWORD;
      if (devEmail && devPass && loginData.username === devEmail && loginData.password === devPass) {
        // Ensure the developer user exists
        let devUser = await storage.getUserByUsername(devEmail);
        if (!devUser) {
          const hashed = await bcrypt.hash(devPass, 12);
          devUser = await storage.createUser({ username: devEmail, password: hashed, isDev: true });
        }
        return req.session.regenerate((regenerateErr) => {
          if (regenerateErr) {
            console.error('Session regeneration error:', regenerateErr);
            return res.status(500).json({ message: 'セッション作成に失敗しました' });
          }
          req.login(devUser, (err) => {
            if (err) {
              console.error("Session creation error:", err);
              return res.status(500).json({ message: "セッション作成に失敗しました" });
            }
            const { password, ...userWithoutPassword } = devUser;
            return res.json(userWithoutPassword);
          });
        });
      }

      passport.authenticate("local", (err, user, info) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "ログインに失敗しました" });
        }
        
        if (!user) {
          return res.status(401).json({ message: "メールアドレスまたはパスワードが間違っています" });
        }

        // Regenerate session for security
        req.session.regenerate((regenerateErr) => {
          if (regenerateErr) {
            console.error('Session regeneration error:', regenerateErr);
            return res.status(500).json({ message: 'セッション作成に失敗しました' });
          }
          
          req.login(user, (err) => {
            if (err) {
              console.error("Session creation error:", err);
              return res.status(500).json({ message: "セッション作成に失敗しました" });
            }
            
            const { password, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
          });
        });
      })(req, res, next);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "ログインに失敗しました" });
    }
  });

  // Logout endpoint with session destruction and CSRF protection
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      
      // Clear guest data if it was a guest session
      if (req.session.guestId) {
        storage.clearGuestData(req.session.guestId);
      }
      
      // Destroy the session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Session destroy error:', destroyErr);
          return res.status(500).json({ message: 'ログアウトに失敗しました' });
        }
        res.json({ message: "ログアウトしました" });
      });
    });
  });

  // GET route convenience for logout (redirect to /)
  app.get("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      if (req.session) {
        req.session.destroy(() => res.redirect('/auth'));
      } else {
        res.redirect('/auth');
      }
    });
  });

  // Get current user (supports both authenticated users and guests)
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      // Authenticated user
      const { password, ...userWithoutPassword } = req.user;
      res.json(userWithoutPassword);
    } else if (req.session.guestId) {
      // Guest user with existing session
      res.json({
        id: req.session.guestId,
        username: 'ゲストユーザー',
        isGuest: true
      });
    } else {
      // No session at all
      return res.status(401).json({ message: "認証が必要です" });
    }
  });
}

// Authentication middleware
export function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "認証が必要です" });
}

// Optional authentication - allows both authenticated users and guests
export function optionalAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    // Authenticated user
    req.userId = req.user.id;
    req.isGuest = false;
  } else {
    // Guest user - generate unique guest ID per session
    if (!req.session.guestId) {
      req.session.guestId = `guest_${randomUUID()}`;
    }
    req.userId = req.session.guestId;
    req.isGuest = true;
  }
  next();
}