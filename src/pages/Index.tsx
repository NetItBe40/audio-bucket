import Layout from "@/components/Layout";
import AudioRecorder from "@/components/AudioRecorder";
import AudioUpload from "@/components/AudioUpload";
import RecordingsList from "@/components/RecordingsList";

const Index = () => {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-12">
        <div className="space-y-6 sm:space-y-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center">
            Nouvel enregistrement
          </h2>
          <AudioRecorder />
          <AudioUpload />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-center">
            Mes enregistrements
          </h2>
          <RecordingsList />
        </div>
      </div>
    </Layout>
  );
};

export default Index;