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
    // Vérifie si l'utilisateur est déjà connecté
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    // Vérifie les erreurs dans l'URL
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Gestion des erreurs provenant de l'URL ou du hash
    const error = searchParams.get("error") || hashParams.get("error");
    const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
    
    if (error) {
      console.error("Erreur d'authentification:", error, errorDescription);
      
      // Messages d'erreur personnalisés
      let errorMessage = "Erreur lors de l'authentification";
      if (error === "access_denied" && errorDescription?.includes("Email link")) {
        errorMessage = "Le lien de confirmation a expiré. Veuillez réessayer de vous connecter.";
      }
      
      toast.error(errorMessage);
    }
  }, [navigate]);

  const handleQuickLogin = async () => {
    try {
      // D'abord, essayons de nous connecter directement
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: "test@example.com",
        password: "testpassword123",
      });

      // Si la connexion échoue, c'est probablement parce que l'utilisateur n'existe pas
      if (signInError) {
        console.log("Tentative de création de l'utilisateur...");
        const { error: signUpError } = await supabase.auth.signUp({
          email: "test@example.com",
          password: "testpassword123",
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (signUpError) {
          toast.error("Erreur lors de la création du compte");
          console.error("Erreur signup:", signUpError);
          return;
        }

        toast.success("Compte créé avec succès! Veuillez vérifier vos emails.");
        return;
      }

      toast.success("Connexion réussie!");
    } catch (error) {
      toast.error("Erreur lors de la connexion rapide");
      console.error("Erreur générale:", error);
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
          redirectTo={window.location.origin}
        />
      </div>
    </div>
  );
};

export default Login;