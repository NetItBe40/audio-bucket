import Layout from "@/components/Layout";
import AudioRecorder from "@/components/AudioRecorder";

const Index = () => {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">
          Nouvel enregistrement
        </h2>
        <AudioRecorder />
      </div>
    </Layout>
  );
};

export default Index;