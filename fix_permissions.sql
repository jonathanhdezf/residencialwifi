-- SOLUCIÓN A ERROR DE PERMISOS (RLS)
-- Copia y pega este código en el Editor SQL de tu panel de Supabase para permitir que los administradores eliminen usuarios.

-- 1. Permitir que los administradores eliminen mensajes de otros usuarios
DROP POLICY IF EXISTS "Admins can delete messages" ON messages;
CREATE POLICY "Admins can delete messages" ON messages
FOR DELETE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- 2. Permitir que los administradores eliminen historial de pagos
DROP POLICY IF EXISTS "Admins can delete payment_history" ON payment_history;
CREATE POLICY "Admins can delete payment_history" ON payment_history
FOR DELETE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- 3. Permitir que los administradores eliminen perfiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles" ON profiles
FOR DELETE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- NOTA: Asegúrate también de que tus políticas de SELECT (lectura) permitan ver la tabla profiles para verificar el rol de admin.
-- Por ejemplo:
-- CREATE POLICY "Enable read access for all users" ON profiles FOR SELECT USING (true);
