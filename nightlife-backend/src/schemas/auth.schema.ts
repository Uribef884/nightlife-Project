// src/schemas/auth.schema.ts
import { z } from "zod";

export const authSchemaRegister = z.object({
  email: z
    .string()
    .email("Formato de email inválido")
    .trim()
    .transform((val) => val.toLowerCase()),

  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe incluir al menos una letra mayúscula")
    .regex(/[0-9]/, "La contraseña debe incluir al menos un número")
    .trim(),
});

export const authSchemaLogin = z.object({
  email: z
    .string()
    .email("Credenciales inválidas")
    .trim()
    .transform((val) => val.toLowerCase()),

  password: z
    .string()
    .min(1, "Credenciales inválidas")
    .trim(),
});

export const changePasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(1, "La contraseña actual es requerida")
    .trim(),

  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe incluir al menos una letra mayúscula")
    .regex(/[0-9]/, "La contraseña debe incluir al menos un número")
    .trim(),

  confirmPassword: z
    .string()
    .min(1, "La confirmación de contraseña es requerida")
    .trim(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las nuevas contraseñas no coinciden",
  path: ["confirmPassword"],
});