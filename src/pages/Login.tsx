import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleQuickLogin = async () => {
    try {
      // First try to create the user
      const { error: signUpError } = await supabase.auth.signUp({
        email: "test@example.com",
        password: "testpassword123",
      });
      
      // Whether the user was created or already existed, try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: "test@example.com",
        password: "testpassword123",
      });
      
      if (signInError) {
        toast.error("Erreur lors de la connexion rapide");
        console.error(signInError);
      }
    } catch (error) {
      toast.error("Erreur lors de la connexion rapide");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Bucket Voice
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Connectez-vous pour commencer à enregistrer
          </p>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={handleQuickLogin}
            className="mb-4"
          >
            Connexion rapide (développement)
          </Button>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="light"
          localization={{
            variables: {
              sign_in: {
                email_label: "Email",
                password_label: "Mot de passe",
                button_label: "Se connecter",
              },
              sign_up: {
                email_label: "Email",
                password_label: "Mot de passe",
                button_label: "S'inscrire",
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;