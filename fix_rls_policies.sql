-- =========================================================
-- SCRIPT DE CORRECIÓN DE POLÍTICAS (LIMPIEZA TOTAL)
-- =========================================================

-- 1. LIMPIAR POLÍTICAS EXISTENTES (Para evitar el error "already exists")
-- Mensajes
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
DROP POLICY IF EXISTS "Users and admins can view messages" ON messages;
DROP POLICY IF EXISTS "Users and admins can insert messages" ON messages;
DROP POLICY IF EXISTS "Users and admins can update messages" ON messages;

-- Historial
DROP POLICY IF EXISTS "View own payment history" ON payment_history;
DROP POLICY IF EXISTS "Users and admins can view payment history" ON payment_history;
DROP POLICY IF EXISTS "Admins can manage payment history" ON payment_history;

-- Perfiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON profiles;


-- 2. CREAR NUEVAS POLÍTICAS INTEGRADAS

-- MENSAJES: Lectura
CREATE POLICY "Users and admins can view messages" ON messages
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- MENSAJES: Inserción
CREATE POLICY "Users and admins can insert messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- MENSAJES: Actualización (Marcar como leídos)
CREATE POLICY "Users and admins can update messages" ON messages
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- HISTORIAL: Lectura
CREATE POLICY "Users and admins can view payment history" ON payment_history
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- HISTORIAL: Gestión Total (Admin)
CREATE POLICY "Admins can manage payment history" ON payment_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- PERFILES: Actualización
CREATE POLICY "Users and admins can update profiles" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
