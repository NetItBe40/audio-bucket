import Layout from "@/components/Layout";
import AudioRecorder from "@/components/AudioRecorder";
import RecordingsList from "@/components/RecordingsList";

const Index = () => {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-12">
        <div>
          <h2 className="text-2xl font-bold mb-8 text-center">
            Nouvel enregistrement
          </h2>
          <AudioRecorder />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-8 text-center">
            Mes enregistrements
          </h2>
          <RecordingsList />
        </div>
      </div>
    </Layout>
  );
};

export default Index;