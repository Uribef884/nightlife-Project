import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { Club } from "../entities/Club";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { isDisposableEmail } from "../utils/disposableEmailValidator";
import { clearAnonymousCart } from "../utils/clearAnonymousCart";
import { AuthenticatedRequest } from "../types/express";
import { UnifiedCartItem } from "../entities/UnifiedCartItem";
import { authSchemaRegister, changePasswordSchema } from "../schemas/auth.schema";
import { forgotPasswordSchema, resetPasswordSchema } from "../schemas/forgot.schema";
import { sendPasswordResetEmail } from "../services/emailService";
import { OAuthService, GoogleUserInfo } from "../services/oauthService";
import { sanitizeInput } from "../utils/sanitizeInput";
import { UserService } from "../services/user.service";
import { anonymizeUser, canUserBeDeleted } from "../utils/anonymizeUser";
import { AuthInputSanitizer, validateAuthInputs } from "../utils/authInputSanitizer";
import { strictRateLimiter } from "../middlewares/queryRateLimiter";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const RESET_SECRET = process.env.RESET_SECRET || "dev-reset-secret";
const RESET_EXPIRY = "15m";

export async function register(req: Request, res: Response): Promise<void> {
  try {
    // Enhanced input validation and sanitization
    const validation = validateAuthInputs({
      email: req.body.email?.toLowerCase().trim(),
      password: req.body.password,
      name: req.body.name
    });

    if (!validation.isValid) {
      res.status(400).json({ 
        error: "Datos de entrada inválidos",
        details: validation.errors
      });
      return;
    }

    const { email, password, name } = validation.sanitized;

    const result = authSchemaRegister.safeParse({ email, password });

    if (!result.success) {
      res.status(400).json({
        error: "Datos de entrada inválidos",
        details: result.error.flatten(),
      });
      return;
    }

    if (isDisposableEmail(email)) {
      res.status(403).json({ error: "Dominio de email no permitido" });
      return;
    }

    const repo = AppDataSource.getRepository(User);
    const existing = await repo.findOneBy({ email });
    if (existing) {
      res.status(409).json({ error: "Usuario ya existe" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = repo.create({ 
      email, 
      password: hashed, 
      role: "user",
      isOAuthUser: false
    });
    await repo.save(user);

    const token = jwt.sign({ id: user.id, role: user.role, isDeleted: user.isDeleted }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("❌ Error in register:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  // Enhanced input validation and sanitization
  const validation = validateAuthInputs({
    email: req.body.email?.toLowerCase().trim(),
    password: req.body.password
  });

  if (!validation.isValid) {
    res.status(400).json({ 
      error: "Datos de entrada inválidos",
      details: validation.errors
    });
    return;
  }

  const { email, password } = validation.sanitized;

  if (!email || !password) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOneBy({ email });

  if (!user) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  // Check if user account is deleted
  if (user.isDeleted) {
    res.status(401).json({ error: "La cuenta ha sido eliminada" });
    return;
  }

  // Check if user has a password (not OAuth user)
  if (!user.password) {
    res.status(401).json({ error: "Por favor inicia sesión con Google" });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  // Clear user's existing cart and anonymous cart
  const typedReq = req as AuthenticatedRequest;
  // Get sessionId directly from cookies, not from middleware-processed req.sessionId
  const sessionId = req.cookies?.sessionId;

  // Clear user's existing cart first
  const unifiedCartRepo = AppDataSource.getRepository(UnifiedCartItem);
  await unifiedCartRepo.delete({ userId: user.id });

  // Clear anonymous cart if exists
  if (sessionId) {
    await clearAnonymousCart(sessionId);
    res.clearCookie("sessionId", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  let clubId: string | undefined = undefined;
  if (user.role === "clubowner") {
    // Clear clubId for club owners on login to prevent accidental edits to other clubs
    // They must explicitly select a club after login
    console.log(`[LOGIN] Clearing clubId for club owner ${user.id}. Previous clubId: ${user.clubId}`);
    clubId = undefined;
    
    // Also clear it in the database to ensure consistency
    user.clubId = null;
    try {
      // Use direct SQL update to ensure it actually gets saved
      await repo.manager.query('UPDATE "user" SET "clubId" = NULL WHERE "id" = $1', [user.id]);
      console.log(`[LOGIN] Successfully cleared clubId in DB using direct SQL update`);
    } catch (error) {
      console.error(`[LOGIN] Failed to clear clubId in DB for user ${user.id}:`, error);
    }
  } else if (user.role === "bouncer" || user.role === "waiter") {
    clubId = user.clubId || undefined;
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      isDeleted: user.isDeleted,
      ...(clubId ? { clubId } : {}),
      ...(user.role === "clubowner" ? { clubIds: user.clubIds || [] } : {}),
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    message: "Inicio de sesión exitoso",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(clubId ? { clubId } : {}),
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const typedReq = req as AuthenticatedRequest;
  const sessionId = !typedReq.user?.id && typedReq.sessionId ? typedReq.sessionId : null;
  const userId = (req as AuthenticatedRequest).user?.id;

  const unifiedCartRepo = AppDataSource.getRepository(UnifiedCartItem);

  try {
    if (userId) {
      // Clear clubId for club owners on logout to prevent accidental edits
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOneBy({ id: userId });
      
      if (user && user.role === "clubowner") {
        console.log(`[LOGOUT] Clearing clubId for club owner ${user.id}. Previous clubId: ${user.clubId}`);
        user.clubId = null;
        try {
          // Use direct SQL update to ensure it actually gets saved
          await userRepo.manager.query('UPDATE "user" SET "clubId" = NULL WHERE "id" = $1', [user.id]);
          console.log(`[LOGOUT] Successfully cleared clubId in DB using direct SQL update`);
        } catch (error) {
          console.error(`[LOGOUT] Failed to clear clubId in DB for user ${user.id}:`, error);
        }
      }
      
      await unifiedCartRepo.delete({ userId });
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }

    if (sessionId) {
      await clearAnonymousCart(sessionId);
      res.clearCookie("sessionId", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    res.json({ message: "Sesión cerrada exitosamente" });
  } catch (error) {
    console.error("❌ Error during logout:", error);
    res.status(500).json({ error: "Error al cerrar sesión" });
  }
}



export async function deleteOwnUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: userId });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (user.isDeleted) {
      res.status(400).json({ error: "La cuenta de usuario ya ha sido eliminada" });
      return;
    }

    // Check if user can be deleted
    const canDelete = await canUserBeDeleted(userId);
    if (!canDelete.success) {
      if (canDelete.requiresTransfer) {
        res.status(400).json({ 
          error: canDelete.message,
          requiresTransfer: true,
          clubsToTransfer: canDelete.clubsToTransfer?.map(club => ({
            id: club.id,
            name: club.name
          }))
        });
      } else {
        res.status(400).json({ error: canDelete.message });
      }
      return;
    }

    // Anonymize the user instead of hard deleting
    const result = await anonymizeUser(userId);
    
    if (result.success) {
      res.json({ message: "Tu cuenta ha sido anonimizada exitosamente" });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}



export async function forgotPassword(req: Request, res: Response): Promise<void> {
  console.log('🔐 [AUTH_CONTROLLER] Forgot password request received');
  
  // Enhanced input validation and sanitization
  const validation = validateAuthInputs({
    email: req.body.email?.toLowerCase().trim()
  });

  if (!validation.isValid) {
    console.log('❌ [AUTH_CONTROLLER] Input validation failed:', validation.errors);
    res.status(200).json({ message: "Se ha enviado el enlace de restablecimiento." });
    return;
  }

  const { email } = validation.sanitized;
  console.log('📧 [AUTH_CONTROLLER] Processing forgot password for email:', email);
  
  const user = await AppDataSource.getRepository(User).findOneBy({ email });
  if (!user) {
    console.log('⚠️ [AUTH_CONTROLLER] User not found for email:', email);
    res.status(200).json({ message: "Se ha enviado el enlace de restablecimiento." });
    return;
  }

  console.log('✅ [AUTH_CONTROLLER] User found, generating reset token for:', email);
  
  const token = jwt.sign({ id: user.id }, RESET_SECRET, { expiresIn: RESET_EXPIRY });
  console.log('🔑 [AUTH_CONTROLLER] Reset token generated, sending email...');
  
  try {
    await sendPasswordResetEmail(user.email, token);
    console.log('✅ [AUTH_CONTROLLER] Password reset email sent successfully');
    res.status(200).json({ message: "Se ha enviado el enlace de restablecimiento." });
  } catch (error) {
    console.error('❌ [AUTH_CONTROLLER] Failed to send password reset email:', error);
    res.status(500).json({ error: "Error al enviar el email de restablecimiento" });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  // Enhanced input validation and sanitization
  const validation = validateAuthInputs({
    resetToken: req.body.token,
    password: req.body.newPassword
  });

  if (!validation.isValid) {
    res.status(400).json({ 
      error: "Datos de entrada inválidos",
      details: validation.errors
    });
    return;
  }

  const { resetToken: token, password: newPassword } = validation.sanitized;

  try {
    const payload = jwt.verify(token, RESET_SECRET) as { id: string };
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: payload.id });

    if (!user) {
      res.status(400).json({ error: "Token o usuario inválido" });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await repo.save(user);

    res.status(200).json({ message: "Contraseña restablecida exitosamente" });
  } catch (err) {
    console.error("❌ Error resetting password:", err);
    res.status(400).json({ error: "Token inválido o expirado" });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const typedReq = req as AuthenticatedRequest;
    const userId = typedReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    // Enhanced input validation and sanitization
    const validation = validateAuthInputs({
      password: req.body.oldPassword
    });

    const newPasswordValidation = validateAuthInputs({
      password: req.body.newPassword
    });

    if (!validation.isValid || !newPasswordValidation.isValid) {
      res.status(400).json({
        error: "Datos de entrada inválidos",
        details: [...validation.errors, ...newPasswordValidation.errors]
      });
      return;
    }

    const { password: oldPassword } = validation.sanitized;
    const { password: newPassword } = newPasswordValidation.sanitized;

    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: userId });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    // Check if user account is deleted
    if (user.isDeleted) {
      res.status(401).json({ error: "La cuenta ha sido eliminada" });
      return;
    }

    // Check if user has a password (not OAuth user)
    if (!user.password) {
      res.status(400).json({ error: "No se puede cambiar la contraseña para usuarios OAuth" });
      return;
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      res.status(400).json({ error: "La contraseña actual es incorrecta" });
      return;
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      res.status(400).json({ error: "La nueva contraseña debe ser diferente a la contraseña actual" });
      return;
    }

    // Hash and save new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await repo.save(user);

    res.status(200).json({ message: "Contraseña cambiada exitosamente" });
  } catch (error) {
    console.error("❌ Error changing password:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export const getCurrentUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }

  // Check if user account is deleted
  if (user.isDeleted) {
    res.status(401).json({ error: "La cuenta ha sido eliminada" });
    return;
  }

  // Get full user data from database to include isOAuthUser
  const repo = AppDataSource.getRepository(User);
  const fullUser = await repo.findOneBy({ id: user.id });
  
  if (!fullUser) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  const { id, email, role, clubId, isOAuthUser, firstName, lastName, avatar } = fullUser;
  res.json({ 
    id, 
    email, 
    role, 
    clubId, 
    isOAuthUser,
    firstName,
    lastName,
    avatar
  });
};

// ================================
// GOOGLE OAUTH CONTROLLERS
// ================================

/**
 * GET /auth/google - Initiate Google OAuth flow
 */
export async function googleAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Check if required environment variables are set
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth environment variables');
      res.status(500).json({ 
        error: "Google OAuth no configurado",
        missing: [
          !process.env.GOOGLE_CLIENT_ID && 'GOOGLE_CLIENT_ID',
          !process.env.GOOGLE_CLIENT_SECRET && 'GOOGLE_CLIENT_SECRET',
          !process.env.GOOGLE_REDIRECT_URI && 'GOOGLE_REDIRECT_URI'
        ].filter(Boolean)
      });
      return;
    }

    // Pass sessionId in state to preserve cart during OAuth flow
    const sessionId = req.sessionId;
    console.log('🔍 Initiating Google OAuth flow:', {
      sessionId: sessionId || 'none',
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    });
    
    const authUrl = OAuthService.getGoogleAuthUrl(sessionId || undefined);
    console.log('🔗 Redirecting to Google OAuth URL:', authUrl);
    
    res.redirect(authUrl);
  } catch (error) {
    console.error("❌ Error initiating Google OAuth:", error);
    res.status(500).json({ error: "Error al iniciar la autenticación con Google" });
  }
}

/**
 * GET /auth/google/callback - Handle Google OAuth callback
 */
export async function googleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Log all query parameters for debugging
    console.log('🔍 OAuth callback received:', {
      code: code ? 'present' : 'missing',
      state: state || 'none',
      error: error || 'none',
      error_description: error_description || 'none',
      allParams: req.query
    });
    
    // Handle OAuth errors from Google
    if (error) {
      console.error('❌ Google OAuth error:', error, error_description);
      const frontendUrl = process.env.FRONTEND_BASE_URL;
      res.redirect(`${frontendUrl}/auth/login?error=oauth_${error}`);
      return;
    }
    
    if (!code) {
      console.error('❌ Missing authorization code in OAuth callback');
      res.status(400).json({ 
        error: "Código de autorización faltante",
        received_params: req.query,
        help: "Este endpoint solo debe ser accedido mediante el flujo OAuth de Google. Comienza en /auth/google"
      });
      return;
    }

    // Verify Google token and get user info
    const googleUser = await OAuthService.verifyGoogleToken(code as string);
    
    if (!googleUser.emailVerified) {
      res.status(400).json({ error: "Email de Google no verificado" });
      return;
    }

    // Check for disposable email
    if (isDisposableEmail(googleUser.email)) {
      res.status(403).json({ error: "Dominio de email no permitido" });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    let user = await userRepo.findOneBy({ email: googleUser.email });

    if (user) {
      // Check if user account is deleted
      if (user.isDeleted) {
        res.status(401).json({ error: "La cuenta ha sido eliminada" });
        return;
      }
      
      // Existing user - update OAuth info if not already set
      if (!user.isOAuthUser) {
        user.googleId = googleUser.googleId;
        user.firstName = googleUser.firstName;
        user.lastName = googleUser.lastName;
        user.avatar = googleUser.avatar;
        user.isOAuthUser = true;
        await userRepo.save(user);
      }
    } else {
      // New user - create with OAuth info
      user = userRepo.create({
        email: googleUser.email,
        googleId: googleUser.googleId,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        avatar: googleUser.avatar,
        role: "user",
        isOAuthUser: true,
      });
      await userRepo.save(user);
    }

    // Handle cart migration from sessionId (if exists)
    const sessionId = state as string;
    if (sessionId) {
      await clearAnonymousCart(sessionId);
    }

    // Get clubId for clubowner/bouncer/waiter
    let clubId: string | undefined = undefined;
    if (user.role === "clubowner") {
      // Use the active clubId from user object (already set in clubIds array)
      clubId = user.clubId || undefined;
    } else if (user.role === "bouncer" || user.role === "waiter") {
      clubId = user.clubId || undefined;
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        isDeleted: user.isDeleted,
        ...(clubId ? { clubId } : {}),
        ...(user.role === "clubowner" ? { clubIds: user.clubIds || [] } : {}),
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Clear sessionId cookie if it exists
    if (sessionId) {
      res.clearCookie("sessionId", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    // Redirect to frontend callback page with user data
    const frontendUrl = process.env.FRONTEND_BASE_URL;
    const redirectUrl = `${frontendUrl}/auth/google/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      isOAuthUser: user.isOAuthUser
    }))}`;
    
    res.redirect(redirectUrl);

  } catch (error) {
    console.error("❌ Error in Google OAuth callback:", error);
    const frontendUrl = process.env.FRONTEND_BASE_URL;
    res.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
  }
}

/**
 * POST /auth/google/token - Verify Google ID token (for frontend integration)
 */
export async function googleTokenAuth(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body;
    const typedReq = req as AuthenticatedRequest;
    
    if (!idToken) {
      res.status(400).json({ error: "Token de ID de Google faltante" });
      return;
    }

    // Verify Google ID token
    const googleUser = await OAuthService.verifyGoogleIdToken(idToken);
    
    if (!googleUser.emailVerified) {
      res.status(400).json({ error: "Email de Google no verificado" });
      return;
    }

    // Check for disposable email
    if (isDisposableEmail(googleUser.email)) {
      res.status(403).json({ error: "Dominio de email no permitido" });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    let user = await userRepo.findOneBy({ email: googleUser.email });

    if (user) {
      // Check if user account is deleted
      if (user.isDeleted) {
        res.status(401).json({ error: "La cuenta ha sido eliminada" });
        return;
      }
      
      // Existing user - update OAuth info if not already set
      if (!user.isOAuthUser) {
        user.googleId = googleUser.googleId;
        user.firstName = googleUser.firstName;
        user.lastName = googleUser.lastName;
        user.avatar = googleUser.avatar;
        user.isOAuthUser = true;
        await userRepo.save(user);
      }
    } else {
      // New user - create with OAuth info
      user = userRepo.create({
        email: googleUser.email,
        googleId: googleUser.googleId,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        avatar: googleUser.avatar,
        role: "user",
        isOAuthUser: true,
      });
      await userRepo.save(user);
    }

    // Handle cart migration from sessionId
    const sessionId = typedReq.sessionId;
    if (sessionId) {
      await clearAnonymousCart(sessionId);
    }

    // Get clubId for clubowner/bouncer/waiter
    let clubId: string | undefined = undefined;
    if (user.role === "clubowner") {
      // Clear clubId for club owners on login to prevent accidental edits to other clubs
      // They must explicitly select a club after login
      console.log(`[GOOGLE-OAUTH] Clearing clubId for club owner ${user.id}. Previous clubId: ${user.clubId}`);
      clubId = undefined;
      
      // Also clear it in the database to ensure consistency
      user.clubId = null;
      try {
        // Use direct SQL update to ensure it actually gets saved
        await userRepo.manager.query('UPDATE "user" SET "clubId" = NULL WHERE "id" = $1', [user.id]);
        console.log(`[GOOGLE-OAUTH] Successfully cleared clubId in DB using direct SQL update`);
      } catch (error) {
        console.error(`[GOOGLE-OAUTH] Failed to clear clubId in DB for user ${user.id}:`, error);
      }
    } else if (user.role === "bouncer" || user.role === "waiter") {
      clubId = user.clubId || undefined;
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        isDeleted: user.isDeleted,
        ...(clubId ? { clubId } : {}),
        ...(user.role === "clubowner" ? { clubIds: user.clubIds || [] } : {}),
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Clear sessionId cookie
    if (sessionId) {
      res.clearCookie("sessionId", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    res.json({
      message: "Autenticación con Google exitosa",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isOAuthUser: user.isOAuthUser,
        ...(clubId ? { clubId } : {}),
      },
    });

  } catch (error) {
    console.error("❌ Error in Google token authentication:", error);
    res.status(500).json({ error: "Error al autenticar con Google" });
  }
}

export async function checkUserDeletionStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    const result = await canUserBeDeleted(userId);
    
    if (result.success) {
      res.json({ 
        canDelete: true, 
        message: result.message 
      });
    } else {
      res.json({ 
        canDelete: false, 
        message: result.message,
        requiresTransfer: result.requiresTransfer,
        clubsToTransfer: result.clubsToTransfer?.map(club => ({
          id: club.id,
          name: club.name
        }))
      });
    }
  } catch (error) {
    console.error("❌ Error checking user deletion status:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// GET AVAILABLE CLUBS (CLUB OWNER ONLY)
export async function getAvailableClubs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    
    // Load fresh user from DB
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    
    // Only club owners can access this endpoint
    if (user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden acceder a esta información" });
      return;
    }
    
    // Get club details for each owned club
    const clubRepo = AppDataSource.getRepository(Club);
    const clubs = [];
    
    for (const clubId of user.clubIds || []) {
      const club = await clubRepo.findOne({
        where: { id: clubId, isActive: true, isDeleted: false },
        select: ['id', 'name', 'description', 'city', 'profileImageUrl']
      });
      
      if (club) {
        clubs.push({
          id: club.id,
          name: club.name,
          description: club.description,
          city: club.city,
          profileImageUrl: club.profileImageUrl,
          isActive: club.id === user.clubId
        });
      }
    }
    
    res.json({ clubs });
  } catch (error) {
    console.error('Error fetching available clubs:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// SELECT CLUB (CLUB OWNER ONLY)
export async function selectClub(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { clubId } = req.body;
    const userId = req.user!.id;
    
    // Load fresh user from DB
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    
    // Only club owners can select clubs
    if (user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden cambiar de club" });
      return;
    }
    
    // Verify clubId ∈ user.clubIds
    if (!user.clubIds?.includes(clubId)) {
      res.status(403).json({ error: "No autorizado para este club" });
      return;
    }
    
    // Verify club exists and is enabled
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ 
      where: { id: clubId, isActive: true, isDeleted: false } 
    });
    
    if (!club) {
      res.status(404).json({ error: "Club no encontrado o deshabilitado" });
      return;
    }
    
    // Update active club
    user.clubId = clubId;
    await userRepo.save(user);
    
    // Issue new JWT with only necessary claims
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role,
        clubId: user.clubId,
        isDeleted: user.isDeleted,
        ...(user.role === "clubowner" ? { clubIds: user.clubIds || [] } : {}),
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.json({ 
      token, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clubId: user.clubId,
        clubIds: user.clubIds
      }
    });
  } catch (error) {
    console.error('Error selecting club:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// ADMIN: ADD CLUB TO USER (ADMIN ONLY)
export async function adminAddClubToUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, clubId } = req.body;
    
    // Validate input
    if (!userId || !clubId) {
      res.status(400).json({ error: "userId y clubId son requeridos" });
      return;
    }
    
    // Verify club exists and is active
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({
      where: { id: clubId, isActive: true, isDeleted: false }
    });
    
    if (!club) {
      res.status(404).json({ error: "Club no encontrado o deshabilitado" });
      return;
    }
    
    // Use admin service method
    await UserService.adminAddClubToUser(userId, clubId);
    
    res.json({ 
      message: "Club agregado exitosamente al usuario",
      userId,
      clubId,
      clubName: club.name
    });
  } catch (error) {
    console.error('Error adding club to user:', error);
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ error: "Usuario no encontrado" });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}

// ADMIN: REMOVE CLUB FROM USER (ADMIN ONLY)
export async function adminRemoveClubFromUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, clubId } = req.body;
    
    // Validate input
    if (!userId || !clubId) {
      res.status(400).json({ error: "userId y clubId son requeridos" });
      return;
    }
    
    // Verify club exists
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({
      where: { id: clubId }
    });
    
    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }
    
    // Use admin service method
    await UserService.adminRemoveClubFromUser(userId, clubId);
    
    res.json({ 
      message: "Club removido exitosamente del usuario",
      userId,
      clubId,
      clubName: club.name
    });
  } catch (error) {
    console.error('Error removing club from user:', error);
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ error: "Usuario no encontrado" });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}

// ADMIN: GET USER'S OWNED CLUBS (ADMIN ONLY)
export async function adminGetUserClubs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    
    // Validate input
    if (!userId) {
      res.status(400).json({ error: "userId es requerido" });
      return;
    }
    
    // Get user with clubs
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    
    // Get club details for each owned club
    const clubRepo = AppDataSource.getRepository(Club);
    const clubs = [];
    
    if (user.clubIds && user.clubIds.length > 0) {
      for (const clubId of user.clubIds) {
        const club = await clubRepo.findOne({
          where: { id: clubId },
          select: ['id', 'name', 'description', 'city', 'profileImageUrl', 'isActive', 'isDeleted']
        });
        
        if (club) {
          clubs.push({
            id: club.id,
            name: club.name,
            description: club.description,
            city: club.city,
            profileImageUrl: club.profileImageUrl,
            isActive: club.isActive,
            isDeleted: club.isDeleted,
            isActiveClub: club.id === user.clubId
          });
        }
      }
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clubId: user.clubId
      },
      ownedClubs: clubs,
      totalClubs: clubs.length
    });
  } catch (error) {
    console.error('Error fetching user clubs:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// DEBUG: Test endpoint to manually clear clubId
export async function debugClearClubId(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const userRepo = AppDataSource.getRepository(User);
    
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    
    console.log(`[DEBUG] Before clearing - User ${userId} clubId: ${user.clubId}`);
    
    user.clubId = null;
    // Use direct SQL update to ensure it actually gets saved
    await userRepo.manager.query('UPDATE "user" SET "clubId" = NULL WHERE "id" = $1', [userId]);
    
    // Verify the update worked by fetching the user again
    const updatedUser = await userRepo.findOneBy({ id: userId });
    console.log(`[DEBUG] After clearing - User ${userId} clubId: ${updatedUser?.clubId}`);
    
    res.json({ 
      message: "ClubId cleared",
      before: user.clubId,
      after: updatedUser?.clubId,
      userId: userId
    });
  } catch (error) {
    console.error('Error clearing clubId:', error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}