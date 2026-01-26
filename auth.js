/**
 * Auth.js
 * Manages user sessions via Supabase.
 */
import { supabase } from './lib/supabase.js';

export const auth = {
    async login(email, password) {
        // Supabase requires email, but our app uses 'username' sometimes.
        // For this migration, we will assume the input IS an email or we fake an email if it's just a username
        // E.g. username@residential.app
        // ideally user inputs email.

        let finalEmail = email;
        if (!email.includes('@')) {
            finalEmail = `${email.replace(/\s+/g, '')}@portal.local`; // Mock domain for username-based login
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: finalEmail,
            password: password
        });

        if (error) return { success: false, error: error.message };

        // CRITICAL FIX: Verify if the user has a profile in the database.
        // If the admin deleted them, the profile will be missing.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            // User exists in Auth but was deleted from the App (Profiles)
            console.warn("Deleted user tried to login. Denying access.");
            await supabase.auth.signOut();
            return { success: false, error: "Tu cuenta ha sido desactivada o eliminada por el administrador." };
        }

        // Fetch role from metadata or profile
        const user = data.user;
        const role = profile.role || user.user_metadata.role || 'resident';
        const name = profile.username || user.user_metadata.name || email;

        return {
            success: true,
            user: { ...user, role, name, username: email }
        };
    },

    async register(username, password, role = 'resident') {
        let finalEmail = username;
        if (!username.includes('@')) {
            finalEmail = `${username.replace(/\s+/g, '')}@portal.local`;
        }

        const { data, error } = await supabase.auth.signUp({
            email: finalEmail,
            password: password,
            options: {
                data: {
                    role: role,
                    username: username,
                    name: username
                }
            }
        });

        if (error) {
            console.error("Register Error:", error);
            // Check for Zombie Account (Auth exists, Profile deleted)
            // Error handling for localized or case-diff messages
            const msg = error.message.toLowerCase();
            if (msg.includes("user already registered") || msg.includes("usuario ya registrado")) {
                return await this.handleZombieUser(finalEmail, password, username, role);
            }
            return { success: false, error: error.message };
        }
        return { success: true, user: data.user };
    },

    async handleZombieUser(email, password, username, role) {
        // 1. Try to sign in (verify ownership of the zombie account)
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            // Password mismatch or other issue
            console.error("Zombie signin error:", error);
            return { success: false, error: "El usuario ya existe (Auth) y la contraseña no coincide. Contacte con Administración." };
        }

        // 2. Check if profile is truly missing (Deleted via Dashboard)
        const user = data.user;
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            console.log("Profile missing for auth user. Resurrecting...");
            // 3. Resurrect: Manually create the profile since the Trigger won't fire on login
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    username: username,
                    role: role,
                    payment_status: 'paid', // Default status for new/recovered users
                    internet_speed: 20
                });

            if (insertError) {
                console.error("Resurrection failed:", insertError);
                return { success: false, error: "Error al recuperar perfil (" + insertError.message + "). Intenta reiniciar la página." };
            }

            // Update Auth Metadata to match new details
            await supabase.auth.updateUser({
                data: { role, username, name: username }
            });

            return { success: true, user: user };
        }

        return { success: false, error: "El usuario ya está registrado correctamente. Por favor inicie sesión." };
    },

    async logout() {
        await supabase.auth.signOut();
        window.location.href = './index.html';
    },

    async getUser() {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return null;

        const u = data.session.user;
        return {
            id: u.id,
            email: u.email,
            role: u.user_metadata.role,
            name: u.user_metadata.name || u.email,
            username: u.user_metadata.username
        };
    },

    // Guards - Now Async!
    async requireAuth() {
        const user = await this.getUser();
        if (!user) {
            window.location.href = './index.html';
            return null;
        }

        // Verify if user still exists in profiles (Real-time ban/delete check)
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (error || !profile) {
            console.warn('User authenticated but no profile found. Force logout.');
            await this.logout();
            return null;
        }

        return user;
    },

    async requireAdmin() {
        const user = await this.requireAuth();
        if (user && user.role !== 'admin') {
            window.location.href = './dashboard.html';
            return null;
        }
        return user;
    }
};
