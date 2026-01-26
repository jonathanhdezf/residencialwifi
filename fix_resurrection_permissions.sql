-- SOLUCIÓN DE PERMISOS PARA RESURRECCIÓN DE USUARIOS
-- Copia y pega este código en el Editor SQL de tu panel de Supabase.

-- 1. Permitir a los usuarios insertar su propio perfil (Necesario para la recuperación de cuentas)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
FOR INSERT WITH CHECK (
  auth.uid() = id
);

-- 2. Asegurarse de que los usuarios pueden leer su propio perfil (ya debería existir, pero por seguridad)
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
FOR SELECT USING (
  auth.uid() = id
);

-- 3. Asegurarse de que los usuarios pueden actualizar su propio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (
  auth.uid() = id
);
