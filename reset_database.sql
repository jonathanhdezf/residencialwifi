-- =========================================================
-- SCRIPT PARA BORRADO COMPLETO Y LIMPIO (RESET TOTAL)
-- =========================================================

-- OPCIÓN A: BORRAR TODO (Cuentas de usuario, perfiles, mensajes e historial)
-- Gracias al "ON DELETE CASCADE" definido en el esquema, al borrar auth.users se limpia todo.
-- PRECAUCIÓN: Esto borrará también tu cuenta de administrador si no la excluyes.

-- Descomenta la línea de abajo para borrar TODO:
-- DELETE FROM auth.users;


-- OPCIÓN B: BORRAR TODO EXCEPTO EL ADMINISTRADOR
-- Reemplaza 'admin@fiberhub.com' por tu correo real de admin.
-- DELETE FROM auth.users WHERE email != 'admin@fiberhub.com';


-- OPCIÓN C: BORRAR SOLO LOS DATOS (No las cuentas)
-- Si quieres mantener a los usuarios pero limpiar el historial y los chats.
TRUNCATE TABLE public.messages RESTART IDENTITY;
TRUNCATE TABLE public.payment_history RESTART IDENTITY;

-- Opcional: Resetear estados de pago en los perfiles
-- UPDATE public.profiles SET payment_status = 'pending', internet_speed = 150;


-- =========================================================
-- NOTA IMPORTANTE:
-- Para borrar usuarios de 'auth.users' desde el SQL Editor de Supabase
-- no necesitas permisos especiales, pero si lo haces mediante código 
-- necesitas usar la función que creamos anteriormente o el Service Role.
-- =========================================================
