import { useState } from "react";
import Sidebar, { type Screen } from "./components/Sidebar";
import CameraView from "./components/CameraView";
import DetectionFeed from "./components/DetectionFeed";

export default function App() {
  const [screen, setScreen] = useState<Screen>("camera");

  return (
    <div className="h-screen w-screen flex bg-bg text-text-primary overflow-hidden">
      <Sidebar active={screen} onSelect={setScreen} />
      {screen === "camera" && <CameraView />}
      {screen === "detections" && <DetectionFeed />}
    </div>
  );
}
