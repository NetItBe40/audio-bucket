import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Nouvel Enregistrement</CardTitle>
          </CardHeader>
          <CardContent>
            <Button>Commencer l'enregistrement</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mes Enregistrements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Aucun enregistrement pour le moment</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;