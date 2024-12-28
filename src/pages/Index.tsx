import Layout from "@/components/Layout";
import AudioRecorder from "@/components/AudioRecorder";
import AudioUpload from "@/components/AudioUpload";
import RecordingsList from "@/components/RecordingsList";

const Index = () => {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-12">
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-center">
            Nouvel enregistrement
          </h2>
          <AudioRecorder />
          <AudioUpload />
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