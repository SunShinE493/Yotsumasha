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
  
  // Setup CSRF protection (requires 32-character secret)
  const csrfSecret = process.env.CSRF_SECRET || "12345678901234567890123456789012"; // 32 chars
  app.use(csurf(csrfSecret));

  // CSRF token endpoint
  app.get("/api/csrf", (req, res) => {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  });

  // CSRF validation middleware - tiny-csrf handles validation automatically
  // We just need to ensure the token is passed correctly
  const validateCSRF = (req, res, next) => {
    // tiny-csrf automatically validates, so we just proceed
    // It expects _csrf in body or x-csrf-token in headers
    next();
  };

  // Export CSRF middleware for use in other route files
  app.locals.validateCSRF = validateCSRF;

  // Registration endpoint with rate limiting and CSRF protection
  app.post("/api/register", authRateLimit, validateCSRF, async (req, res, next) => {
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
      const user = await storage.createUser({
        username: userData.username,
        password: hashedPassword,
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
  app.post("/api/login", authRateLimit, validateCSRF, (req, res, next) => {
    try {
      const loginData = loginUserSchema.parse(req.body);
      
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
  app.post("/api/logout", validateCSRF, (req, res, next) => {
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