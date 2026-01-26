-- FUNCIÓN PARA ELIMINAR USUARIO DE AUTH.USERS DESDE EL CLIENTE
-- Esta función se ejecuta con privilegios de superusuario (SECURITY DEFINER)
-- para permitir que un administrador borre la cuenta de autenticación de un usuario.

CREATE OR REPLACE FUNCTION delete_user_by_id(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- SEGURIDAD: Solo permitimos que un administrador ejecute esta función
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: Se requieren permisos de administrador.';
  END IF;

  -- Al eliminar de auth.users, el cascade definido en el esquema
  -- borrará automáticamente el perfil, mensajes e historial.
  DELETE FROM auth.users WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Dar permisos para que los usuarios autenticados puedan llamar a la función (RPC)
-- (La lógica interna debería validar si es administrador si se desea más seguridad)
GRANT EXECUTE ON FUNCTION delete_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_by_id(UUID) TO service_role;
