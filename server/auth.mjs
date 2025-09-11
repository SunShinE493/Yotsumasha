// Referenced from blueprint:javascript_auth_all_persistance integration
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import bcrypt from "bcrypt";
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
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export function setupAuth(app) {
  // Session configuration
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "dev-secret-key-for-development-only",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
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

      // Log the user in automatically after registration
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
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

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
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

        req.login(user, (err) => {
          if (err) {
            console.error("Session creation error:", err);
            return res.status(500).json({ message: "セッション作成に失敗しました" });
          }
          
          const { password, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
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

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "ログアウトしました" });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "認証が必要です" });
    }
    
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}

// Authentication middleware
export function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "認証が必要です" });
}